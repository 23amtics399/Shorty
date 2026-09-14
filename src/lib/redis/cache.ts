/**
 * Link cache operations for Redis.
 *
 * Key format: shorty:link:{code}
 *
 * Cached value shape: { url, expiresAt (ms timestamp | null), isActive }
 *
 * Redis is disposable. MongoDB is authoritative.
 * A Redis outage must not break redirect correctness.
 */

import { redis } from './client';
import { REDIS_LINK_CACHE_TTL_SECONDS } from '@/lib/config';
import type { CachedLink } from '@/types';

const KEY_PREFIX = 'shorty:link:';

function cacheKey(code: string): string {
  return `${KEY_PREFIX}${code}`;
}

/**
 * Retrieve a cached link. Returns null on miss or Redis error.
 * Never throws — Redis unavailability must degrade gracefully.
 */
export async function getCachedLink(code: string): Promise<CachedLink | null> {
  try {
    const data = await redis.get<CachedLink>(cacheKey(code));
    return data ?? null;
  } catch {
    // Redis unavailable — caller falls through to MongoDB
    return null;
  }
}

/**
 * Cache a link record. TTL is REDIS_LINK_CACHE_TTL_SECONDS.
 * If the link has an expiresAt, cap the Redis TTL so it doesn't
 * serve stale data after the link has expired in MongoDB.
 *
 * Never throws.
 */
export async function setCachedLink(code: string, link: CachedLink): Promise<void> {
  try {
    let ttlSeconds = REDIS_LINK_CACHE_TTL_SECONDS;

    if (link.expiresAt !== null) {
      const msUntilExpiry = link.expiresAt - Date.now();
      if (msUntilExpiry <= 0) {
        // Link already expired — don't cache
        return;
      }
      // Cap Redis TTL to link's remaining lifetime (convert ms → s, min with config TTL)
      const secondsUntilExpiry = Math.floor(msUntilExpiry / 1000);
      ttlSeconds = Math.min(ttlSeconds, secondsUntilExpiry);
    }

    await redis.set(cacheKey(code), link, { ex: ttlSeconds });
  } catch {
    // Redis unavailable — non-fatal
  }
}

/**
 * Invalidate a cached link (e.g. after disable, delete, or update).
 * Never throws.
 */
export async function invalidateCachedLink(code: string): Promise<void> {
  try {
    await redis.del(cacheKey(code));
  } catch {
    // Redis unavailable — non-fatal
  }
}
