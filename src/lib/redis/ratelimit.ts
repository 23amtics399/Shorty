/**
 * Centralized rate limiting with differentiated failure policies.
 *
 * Key format: shorty:rl:{type}:{identifier}
 * All limits are configurable via environment variables.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DIFFERENTIATED FAILURE POLICY SPECIFICATION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. REDIRECT CACHE (src/proxy.ts & src/app/[shortCode]/route.ts)
 *    Policy: FAIL OPEN
 *    Rationale: Redirection availability is Shorty's primary function. When Redis
 *    is unavailable, requests fall through to MongoDB Atlas to resolve the link.
 *
 * 2. ANONYMOUS LINK CREATION (rateLimitAnonCreate)
 *    Policy: CONSERVATIVE IN-MEMORY EMERGENCY FALLBACK -> FAIL CLOSED
 *    Rationale: Failing completely open allows unauthenticated attackers to flood
 *    MongoDB with millions of link records during a Redis outage.
 *    CRITICAL ARCHITECTURAL NOTE: In serverless environments like Vercel, in-memory
 *    state is isolated per serverless instance (lambda container). It is NOT a
 *    globally synchronized rate limiter. It acts ONLY as a best-effort, emergency
 *    per-container brake. During a Redis outage, anonymous link creation is restricted
 *    to a conservative emergency threshold (max 2 per instance). If exceeded or if
 *    protection cannot be guaranteed, it fails closed (HTTP 429/503).
 *
 * 3. AUTHENTICATED LINK CREATION (rateLimitUserCreate)
 *    Policy: CONSERVATIVE IN-MEMORY EMERGENCY FALLBACK -> FAIL CLOSED
 *    Behavior: When Redis is available, enforces authenticated user limit (50/hr).
 *    When Redis is unavailable, degraded behavior applies: emergency container-local
 *    quota (max 10 per instance) before failing closed. (Note: no database-backed rate
 *    limiter exists; local memory is a temporary emergency brake only).
 *
 * 4. AUTHENTICATION (LOGIN & SIGNUP) (rateLimitAuth)
 *    Policy: FAIL CLOSED
 *    Rationale: Security-critical. Credential stuffing, brute-force password cracking,
 *    and automated bot account creation must NEVER proceed un-rate-limited simply
 *    because Redis is down. Throws HTTP 503 (SERVICE_UNAVAILABLE).
 *
 * 5. ADMIN & SECURITY-SENSITIVE ACTIONS
 *    Policy: FAIL CLOSED
 *    Rationale: Administrative actions must fail closed if security constraints cannot
 *    be reliably verified.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { redis } from './client';
import {
  RATE_LIMIT_ANON_CREATE_PER_HOUR,
  RATE_LIMIT_USER_CREATE_PER_HOUR,
  RATE_LIMIT_API_PER_MINUTE,
  RATE_LIMIT_AUTH_PER_HOUR,
} from '@/lib/config';
import { tooManyRequests, serviceUnavailable } from '@/lib/errors';
import { logger } from '@/lib/logger';

const KEY_PREFIX = 'shorty:rl:';

export type RateLimitFailurePolicy = 'fail_open' | 'fail_closed' | 'conservative_memory';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ─── Emergency In-Memory Fallback Store ─────────────────────────────────────────
// NOTE: Best-effort emergency container-local storage ONLY. Not a distributed store.
interface MemoryEntry {
  count: number;
  expiresAt: number;
}
const memoryRateLimitMap = new Map<string, MemoryEntry>();

function checkMemoryFallback(
  key: string,
  conservativeMax: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const entry = memoryRateLimitMap.get(key);

  if (!entry || entry.expiresAt <= now) {
    const expiresAt = now + windowSeconds * 1000;
    memoryRateLimitMap.set(key, { count: 1, expiresAt });
    return {
      allowed: true,
      remaining: Math.max(0, conservativeMax - 1),
      resetAt: new Date(expiresAt),
    };
  }

  entry.count += 1;
  const allowed = entry.count <= conservativeMax;
  return {
    allowed,
    remaining: Math.max(0, conservativeMax - entry.count),
    resetAt: new Date(entry.expiresAt),
  };
}

/**
 * Check and increment a rate limit counter in Redis with fallback policy handling.
 */
async function checkRateLimit(
  type: string,
  identifier: string,
  maxRequests: number,
  windowSeconds: number,
  failurePolicy: RateLimitFailurePolicy,
  conservativeEmergencyMax = 2,
): Promise<RateLimitResult> {
  const key = `${KEY_PREFIX}${type}:${identifier}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl : windowSeconds) * 1000);

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt,
    };
  } catch (err) {
    logger.warn('Redis rate-limit counter unreachable, activating failure policy', {
      type,
      policy: failurePolicy,
      error: err instanceof Error ? err.message : 'unknown',
    });

    if (failurePolicy === 'fail_closed') {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60 * 1000),
      };
    }

    if (failurePolicy === 'conservative_memory') {
      // Emergency local container fallback with strictly reduced quota
      return checkMemoryFallback(key, conservativeEmergencyMax, windowSeconds);
    }

    // Default: fail_open
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }
}

// ─── Public Rate Limiting Functions ───────────────────────────────────────────

/**
 * Rate limit anonymous link creation by IP.
 * Policy: Conservative memory fallback (max 2 per instance) -> Fail closed.
 */
export async function rateLimitAnonCreate(ip: string): Promise<void> {
  const result = await checkRateLimit(
    'anon_create',
    ip,
    RATE_LIMIT_ANON_CREATE_PER_HOUR,
    3600,
    'conservative_memory',
    2, // Emergency quota during Redis outages
  );

  if (!result.allowed) {
    throw tooManyRequests(
      `Anonymous link creation limit reached. Resets at ${result.resetAt.toISOString()}.`,
    );
  }
}

/**
 * Rate limit authenticated link creation by user ID.
 * Policy: Conservative memory fallback -> Fail closed.
 */
export async function rateLimitUserCreate(userId: string): Promise<void> {
  const result = await checkRateLimit(
    'user_create',
    userId,
    RATE_LIMIT_USER_CREATE_PER_HOUR,
    3600,
    'conservative_memory',
    10, // Emergency quota for authenticated users
  );

  if (!result.allowed) {
    throw tooManyRequests(
      `Link creation limit reached. Resets at ${result.resetAt.toISOString()}.`,
    );
  }
}

/**
 * Rate limit authentication endpoints (login, signup) by IP.
 * Policy: STRICT FAIL CLOSED (security-critical).
 */
export async function rateLimitAuth(ip: string): Promise<void> {
  const result = await checkRateLimit(
    'auth',
    ip,
    RATE_LIMIT_AUTH_PER_HOUR,
    3600,
    'fail_closed',
  );

  if (!result.allowed) {
    // If Redis is unreachable, fail closed with service unavailable to protect accounts
    throw serviceUnavailable(
      'Authentication rate-limiting service is temporarily unavailable. Please try again shortly.',
    );
  }
}

/**
 * Rate limit general API endpoints by IP.
 * Policy: Conservative memory fallback -> Fail closed.
 */
export async function rateLimitApi(ip: string): Promise<void> {
  const result = await checkRateLimit(
    'api',
    ip,
    RATE_LIMIT_API_PER_MINUTE,
    60,
    'conservative_memory',
    10,
  );

  if (!result.allowed) {
    throw tooManyRequests('Too many requests. Please slow down.');
  }
}

/**
 * Extract client IP from Next.js request headers.
 * Correctly extracts first public client from comma-separated x-forwarded-for.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') ?? 'unknown';
}
