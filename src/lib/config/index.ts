/**
 * Centralized application configuration.
 * All environment-derived values live here — never hard-code these elsewhere.
 */

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

// ─── App ───────────────────────────────────────────────────────────────────────
export const APP_URL = optionalEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

// ─── Short code settings ───────────────────────────────────────────────────────
export const SHORT_CODE_LENGTH = optionalEnvInt('SHORT_CODE_LENGTH', 7);
export const SHORT_CODE_MAX_RETRIES = 5;
export const ALIAS_MIN_LENGTH = optionalEnvInt('ALIAS_MIN_LENGTH', 3);
export const ALIAS_MAX_LENGTH = optionalEnvInt('ALIAS_MAX_LENGTH', 50);

// ─── Link lifetime limits (enforced at creation, not just TTL) ─────────────────
/** Max lifetime for links created by anonymous users, in hours. Default: 24h */
export const ANONYMOUS_MAX_LINK_LIFETIME_HOURS = optionalEnvInt(
  'ANONYMOUS_MAX_LINK_LIFETIME_HOURS',
  24,
);
/** Max lifetime for authenticated users, in days. Default: 30d */
export const AUTHENTICATED_MAX_LINK_LIFETIME_DAYS = optionalEnvInt(
  'AUTHENTICATED_MAX_LINK_LIFETIME_DAYS',
  30,
);

// ─── Redis cache ───────────────────────────────────────────────────────────────
/** How long a cached link record lives in Redis (seconds). Default: 1 hour */
export const REDIS_LINK_CACHE_TTL_SECONDS = optionalEnvInt(
  'REDIS_LINK_CACHE_TTL_SECONDS',
  3600,
);

// ─── Rate limits ───────────────────────────────────────────────────────────────
export const RATE_LIMIT_ANON_CREATE_PER_HOUR = optionalEnvInt(
  'RATE_LIMIT_ANON_CREATE_PER_HOUR',
  5,
);
export const RATE_LIMIT_USER_CREATE_PER_HOUR = optionalEnvInt(
  'RATE_LIMIT_USER_CREATE_PER_HOUR',
  50,
);
export const RATE_LIMIT_API_PER_MINUTE = optionalEnvInt('RATE_LIMIT_API_PER_MINUTE', 30);
export const RATE_LIMIT_AUTH_PER_HOUR = optionalEnvInt('RATE_LIMIT_AUTH_PER_HOUR', 10);

// ─── Admin ─────────────────────────────────────────────────────────────────────
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';

export const config = {
  appUrl: APP_URL,
  shortCode: {
    length: SHORT_CODE_LENGTH,
    maxRetries: SHORT_CODE_MAX_RETRIES,
    aliasMinLength: ALIAS_MIN_LENGTH,
    aliasMaxLength: ALIAS_MAX_LENGTH,
  },
  links: {
    anonymousMaxLifetimeHours: ANONYMOUS_MAX_LINK_LIFETIME_HOURS,
    authenticatedMaxLifetimeDays: AUTHENTICATED_MAX_LINK_LIFETIME_DAYS,
  },
  redis: {
    linkCacheTtlSeconds: REDIS_LINK_CACHE_TTL_SECONDS,
  },
  rateLimit: {
    anonCreatePerHour: RATE_LIMIT_ANON_CREATE_PER_HOUR,
    userCreatePerHour: RATE_LIMIT_USER_CREATE_PER_HOUR,
    apiPerMinute: RATE_LIMIT_API_PER_MINUTE,
    authPerHour: RATE_LIMIT_AUTH_PER_HOUR,
  },
  admin: {
    email: ADMIN_EMAIL,
  },
} as const;
