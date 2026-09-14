/**
 * Click tracking and persistence operations between Redis and MongoDB.
 *
 * Architecture:
 * - Redis fast-path HIT: atomically increments Redis counter via INCR (key: shorty:clicks:{code})
 *   scheduled in the request lifecycle using waitUntil().
 * - Cache MISS: route handler increments MongoDB via atomic $inc: { clickCount: 1 + pendingClicks }.
 * - Persistence Protocol & Failure Recovery:
 *     1. Atomically claim/remove pending counter from Redis (GETDEL).
 *     2. Attempt atomic MongoDB persistence via $inc: { clickCount: pending }.
 *     3. If MongoDB persistence fails or times out, immediately restore the claimed count
 *        back to Redis using atomic INCRBY.
 *     4. Log the persistence failure and rollback.
 *     5. Never report clicks as durably persisted until MongoDB confirms the write.
 * - Dashboard / Admin UI:
 *     Distinguishes between durably persisted MongoDB clicks and pending Redis clicks.
 *     Displays a combined total while MongoDB catches up, and triggers background flushes.
 *
 * Crash Window Disclosure:
 * Redis GETDEL is atomic in Redis and MongoDB $inc is atomic in MongoDB, but the combined
 * multi-step operation is not a distributed two-phase commit transaction. In the event of an
 * unrecoverable hard crash (e.g. fatal OOM, unhandled SIGKILL, hardware power loss) between
 * the Redis removal and the completion of the INCRBY recovery, claimed clicks in that specific
 * process execution could be lost. We provide atomic click counting with failure recovery
 * and eventual persistence, rather than mathematically guaranteed distributed exactly-once semantics.
 */

import { redis } from './client';
import { Link } from '@/lib/db/models/Link';
import { logger } from '@/lib/logger';

const CLICK_KEY_PREFIX = 'shorty:clicks:';

export function getClickKey(code: string): string {
  return `${CLICK_KEY_PREFIX}${code}`;
}

/**
 * Increment the Redis click counter for a short code.
 * Used during Redis cache hits.
 * Never throws — failures degrade gracefully.
 */
export async function incrementClickCounter(code: string): Promise<number | null> {
  try {
    const key = getClickKey(code);
    const count = await redis.incr(key);
    return count;
  } catch (err) {
    logger.warn('Failed to increment Redis click counter', {
      code,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}

/**
 * Get current pending (unflushed) click count in Redis for a code.
 * Does NOT reset or delete the counter.
 * Returns 0 on miss or error.
 */
export async function getPendingClicks(code: string): Promise<number> {
  try {
    const val = await redis.get<number | string>(getClickKey(code));
    if (val === null || val === undefined) return 0;
    const count = typeof val === 'number' ? val : parseInt(val, 10);
    return isNaN(count) ? 0 : Math.max(0, count);
  } catch {
    return 0;
  }
}

/**
 * Atomically retrieve and reset the pending click counter in Redis.
 * Uses GETDEL so increments occurring concurrently are never lost.
 */
export async function getAndResetPendingClicks(code: string): Promise<number> {
  try {
    const key = getClickKey(code);
    const val = await redis.getdel<number | string>(key);
    if (val === null || val === undefined) return 0;
    const count = typeof val === 'number' ? val : parseInt(val, 10);
    return isNaN(count) ? 0 : Math.max(0, count);
  } catch {
    return 0;
  }
}

/**
 * Atomically restore claimed clicks back to Redis using INCRBY.
 * Called when a MongoDB persistence operation fails after GETDEL.
 */
export async function restorePendingClicks(code: string, count: number): Promise<number | null> {
  if (count <= 0) return null;
  try {
    const key = getClickKey(code);
    const newTotal = await redis.incrby(key, count);
    return newTotal;
  } catch (err) {
    logger.error('CRITICAL: Failed to restore pending clicks to Redis via INCRBY', {
      code,
      count,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

/**
 * Flush pending clicks from Redis to MongoDB for a single link code.
 *
 * Distributed Persistence Protocol:
 * 1. Atomically claim/remove the pending counter from Redis via GETDEL.
 * 2. Attempt atomic MongoDB persistence via $inc: { clickCount: pending }.
 * 3. If MongoDB persistence fails, restore the claimed count to Redis via atomic INCRBY.
 * 4. Log the failure and rollback.
 * 5. Returns the number of durably persisted clicks (0 on failure/rollback).
 */
export async function flushPendingClicks(code: string): Promise<number> {
  let pending = 0;
  try {
    pending = await getAndResetPendingClicks(code);
    if (pending <= 0) return 0;

    const res = await Link.updateOne(
      { code },
      {
        $inc: { clickCount: pending },
        $set: { lastAccessedAt: new Date() },
      },
    );

    // Verify update was matched/acknowledged
    if (res && res.matchedCount === 0) {
      throw new Error(`Link code "${code}" not found in MongoDB`);
    }

    return pending;
  } catch (err) {
    if (pending > 0) {
      try {
        await restorePendingClicks(code, pending);
        logger.warn('MongoDB click persistence failed; restored pending clicks to Redis via INCRBY', {
          code,
          restoredClicks: pending,
          error: err instanceof Error ? err.message : 'unknown',
        });
      } catch (restoreErr) {
        logger.error('CRITICAL: Failed to restore pending clicks to Redis after MongoDB failure', {
          code,
          unpersistedClicks: pending,
          mongoError: err instanceof Error ? err.message : 'unknown',
          restoreError: restoreErr instanceof Error ? restoreErr.message : 'unknown',
        });
      }
    } else {
      logger.warn('Failed to flush pending clicks to MongoDB', {
        code,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }

    // Never report clicks as durably persisted until MongoDB succeeds
    return 0;
  }
}

export interface EnrichedClickData {
  clickCount: number;
  persistedClicks: number;
  pendingClicks: number;
}

/**
 * Enriches an array of link documents with pending Redis clicks.
 * Distinguishes between persisted MongoDB clicks and pending Redis clicks.
 * If pending clicks exist, triggers a background flush to MongoDB using request-lifecycle support.
 */
export async function enrichLinksWithPendingClicks<T extends { code: string; clickCount: number }>(
  links: T[],
): Promise<(T & EnrichedClickData)[]> {
  if (!links.length) return [];

  try {
    return await Promise.all(
      links.map(async (link) => {
        const pending = await getPendingClicks(link.code);
        const persisted = link.clickCount;
        if (pending > 0) {
          // Schedule background flush to MongoDB
          flushPendingClicks(link.code).catch(() => 0);

          return {
            ...link,
            persistedClicks: persisted,
            pendingClicks: pending,
            clickCount: persisted + pending,
          };
        }
        return {
          ...link,
          persistedClicks: persisted,
          pendingClicks: 0,
          clickCount: persisted,
        };
      }),
    );
  } catch {
    // If Redis is unavailable, return links with 0 pending clicks
    return links.map((link) => ({
      ...link,
      persistedClicks: link.clickCount,
      pendingClicks: 0,
    }));
  }
}

