import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { GET } from '@/app/[shortCode]/route';
import { Link } from '@/lib/db/models/Link';
import {
  incrementClickCounter,
  getPendingClicks,
  getAndResetPendingClicks,
  restorePendingClicks,
  flushPendingClicks,
  enrichLinksWithPendingClicks,
} from '@/lib/redis/clicks';
import { redis } from '@/lib/redis/client';

// In-memory Redis simulation for cache and click tracking
const redisStore = new Map<string, any>();

vi.mock('@/lib/db/mongodb', () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db/models/Link', () => ({
  Link: {
    findOne: vi.fn(),
    updateOne: vi.fn().mockReturnValue(Promise.resolve()),
  },
}));

vi.mock('@/lib/redis/cache', () => ({
  getCachedLink: vi.fn(async (code: string) => redisStore.get(`shorty:link:${code}`) ?? null),
  setCachedLink: vi.fn(async (code: string, data: any) => {
    redisStore.set(`shorty:link:${code}`, data);
  }),
  invalidateCachedLink: vi.fn(async (code: string) => {
    redisStore.delete(`shorty:link:${code}`);
  }),
}));

vi.mock('@/lib/redis/client', () => ({
  redis: {
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    incr: vi.fn(async (key: string) => {
      const current = typeof redisStore.get(key) === 'number' ? redisStore.get(key) : 0;
      const next = current + 1;
      redisStore.set(key, next);
      return next;
    }),
    incrby: vi.fn(async (key: string, count: number) => {
      const current = typeof redisStore.get(key) === 'number' ? redisStore.get(key) : 0;
      const next = current + count;
      redisStore.set(key, next);
      return next;
    }),
    getdel: vi.fn(async (key: string) => {
      const val = redisStore.get(key);
      redisStore.delete(key);
      return val ?? null;
    }),
    del: vi.fn(async (key: string) => {
      redisStore.delete(key);
    }),
  },
}));

// Mock fetch for proxy.ts REST calls (get and incr)
function setupDefaultFetchMock() {
  global.fetch = vi.fn(async (url: string | URL | Request) => {
    const urlStr = url.toString();
    const getMatch = urlStr.match(/\/get\/([^?]+)/);
    if (getMatch) {
      const key = decodeURIComponent(getMatch[1]);
      const val = redisStore.get(key);
      return {
        ok: true,
        json: async () => ({ result: val ? JSON.stringify(val) : null }),
      } as any;
    }
    const incrMatch = urlStr.match(/\/incr\/([^?]+)/);
    if (incrMatch) {
      const key = decodeURIComponent(incrMatch[1]);
      const current = typeof redisStore.get(key) === 'number' ? redisStore.get(key) : 0;
      const next = current + 1;
      redisStore.set(key, next);
      return {
        ok: true,
        json: async () => ({ result: next }),
      } as any;
    }
    return { ok: false } as any;
  });
}

describe('Integration — Click Tracking & Analytics Architecture (Scenarios 1 to 10)', () => {
  const testCode = 'clktrk1';
  const testLink = {
    _id: 'mock-mongo-link-1',
    code: testCode,
    originalUrl: 'https://example.com/target',
    isActive: true,
    expiresAt: null as Date | null,
    clickCount: 10,
  };

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    redisStore.clear();
    setupDefaultFetchMock();
    vi.clearAllMocks();
  });

  // ── 1. Redis Cache Hit ───────────────────────────────────────────────────────
  it('Scenario 1: Redis cache hit increments Redis click counter without touching MongoDB', async () => {
    // Populate Redis cache
    redisStore.set(`shorty:link:${testCode}`, {
      url: testLink.originalUrl,
      isActive: true,
      expiresAt: null,
    });

    const req = new NextRequest(`https://shorty.sji.one/${testCode}`);
    const res = await proxy(req);

    // Immediate 302 redirect
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(testLink.originalUrl);

    // Redis counter incremented to 1
    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBe(1);

    // MongoDB was NOT called synchronously (redirect stays fast)
    expect(Link.updateOne).not.toHaveBeenCalled();
  });

  // ── 2. Redis Cache Miss ─────────────────────────────────────────────────────
  it('Scenario 2: Redis cache miss increments click count via route handler exactly once', async () => {
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...testLink }),
    } as any);

    // Request through proxy misses
    const proxyReq = new NextRequest(`https://shorty.sji.one/${testCode}`);
    const proxyRes = await proxy(proxyReq);
    expect(proxyRes.headers.get('location')).toBeNull(); // fell through
    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBeUndefined(); // proxy did NOT increment

    // Request reaches route handler
    const routeRes = await GET(proxyReq, { params: Promise.resolve({ shortCode: testCode }) });
    expect(routeRes.status).toBe(302);
    expect(routeRes.headers.get('location')).toBe(testLink.originalUrl);

    // MongoDB clickCount incremented by exactly 1
    expect(Link.updateOne).toHaveBeenCalledWith(
      { _id: testLink._id },
      expect.objectContaining({
        $inc: { clickCount: 1 },
      }),
    );
  });

  // ── 3. 10 Hits ──────────────────────────────────────────────────────────────
  it('Scenario 3: 10 simulated cache hits produce exactly 10 Redis increments', async () => {
    redisStore.set(`shorty:link:${testCode}`, {
      url: testLink.originalUrl,
      isActive: true,
      expiresAt: null,
    });

    for (let i = 0; i < 10; i++) {
      const req = new NextRequest(`https://shorty.sji.one/${testCode}`);
      const res = await proxy(req);
      expect(res.status).toBe(302);
    }

    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBe(10);
    expect(Link.updateOne).not.toHaveBeenCalled();
  });

  // ── 4. 100 Hits ─────────────────────────────────────────────────────────────
  it('Scenario 4: 100 simulated cache hits produce exactly 100 Redis increments', async () => {
    redisStore.set(`shorty:link:${testCode}`, {
      url: testLink.originalUrl,
      isActive: true,
      expiresAt: null,
    });

    for (let i = 0; i < 100; i++) {
      const req = new NextRequest(`https://shorty.sji.one/${testCode}`);
      const res = await proxy(req);
      expect(res.status).toBe(302);
    }

    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBe(100);
    expect(Link.updateOne).not.toHaveBeenCalled();
  });

  // ── 5. Disabled Link ────────────────────────────────────────────────────────
  it('Scenario 5: disabled link does NOT increment click counter', async () => {
    // Cache has disabled link
    redisStore.set(`shorty:link:${testCode}`, {
      url: testLink.originalUrl,
      isActive: false,
      expiresAt: null,
    });

    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...testLink, isActive: false }),
    } as any);

    const req = new NextRequest(`https://shorty.sji.one/${testCode}`);
    const proxyRes = await proxy(req);
    expect(proxyRes.headers.get('location')).toBeNull(); // falls through

    const routeRes = await GET(req, { params: Promise.resolve({ shortCode: testCode }) });
    expect(routeRes.status).toBe(410); // Gone

    // Counter must NOT be incremented
    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBeUndefined();
    expect(Link.updateOne).not.toHaveBeenCalled();
  });

  // ── 6. Expired Link ─────────────────────────────────────────────────────────
  it('Scenario 6: expired link does NOT increment click counter', async () => {
    const expiredAt = Date.now() - 10000;
    redisStore.set(`shorty:link:${testCode}`, {
      url: testLink.originalUrl,
      isActive: true,
      expiresAt: expiredAt,
    });

    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...testLink, expiresAt: new Date(expiredAt) }),
    } as any);

    const req = new NextRequest(`https://shorty.sji.one/${testCode}`);
    const proxyRes = await proxy(req);
    expect(proxyRes.headers.get('location')).toBeNull();

    const routeRes = await GET(req, { params: Promise.resolve({ shortCode: testCode }) });
    expect(routeRes.status).toBe(410);

    // Counter must NOT be incremented
    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBeUndefined();
    expect(Link.updateOne).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $inc: expect.anything() }),
    );
  });

  // ── 7. Deleted / Nonexistent Link ───────────────────────────────────────────
  it('Scenario 7: nonexistent link does NOT increment click counter', async () => {
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as any);

    const req = new NextRequest('https://shorty.sji.one/nonexistent');
    const proxyRes = await proxy(req);
    expect(proxyRes.headers.get('location')).toBeNull();

    const routeRes = await GET(req, { params: Promise.resolve({ shortCode: 'nonexistent' }) });
    expect(routeRes.status).toBe(404);

    expect(redisStore.get('shorty:clicks:nonexistent')).toBeUndefined();
    expect(Link.updateOne).not.toHaveBeenCalled();
  });

  // ── 8. Counter Persistence (Flushing to MongoDB) ────────────────────────────
  it('Scenario 8: flushPendingClicks atomically persists accumulated Redis clicks to MongoDB and clears key', async () => {
    // 25 clicks accumulated in Redis
    redisStore.set(`shorty:clicks:${testCode}`, 25);

    const flushed = await flushPendingClicks(testCode);
    expect(flushed).toBe(25);

    // MongoDB updated with $inc: { clickCount: 25 }
    expect(Link.updateOne).toHaveBeenCalledWith(
      { code: testCode },
      expect.objectContaining({
        $inc: { clickCount: 25 },
        $set: expect.objectContaining({ lastAccessedAt: expect.any(Date) }),
      }),
    );

    // Redis counter is now cleared (reset)
    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBeUndefined();

    // Subsequent flush does nothing
    const secondFlush = await flushPendingClicks(testCode);
    expect(secondFlush).toBe(0);
  });

  // ── 9. No Double Counting ───────────────────────────────────────────────────
  it('Scenario 9: prevents double counting across Redis hits, misses, and flushes', async () => {
    let mongoClickCount = 10;
    vi.mocked(Link.updateOne).mockImplementation(((query: any, update: any) => {
      if (update.$inc?.clickCount) {
        mongoClickCount += update.$inc.clickCount;
      }
      return Promise.resolve({} as any);
    }) as any);

    vi.mocked(Link.findOne).mockImplementation(
      () =>
        ({
          lean: vi.fn().mockResolvedValue({
            ...testLink,
            clickCount: mongoClickCount,
          }),
        }) as any,
    );

    // Warm Redis cache
    redisStore.set(`shorty:link:${testCode}`, {
      url: testLink.originalUrl,
      isActive: true,
      expiresAt: null,
    });

    // 1. Five cache hits through proxy
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest(`https://shorty.sji.one/${testCode}`);
      await proxy(req);
    }
    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBe(5);
    expect(mongoClickCount).toBe(10); // MongoDB not touched yet

    // 2. Dashboard requests links — must combine 10 + 5 = 15 without double counting
    const enriched = await enrichLinksWithPendingClicks([
      { code: testCode, clickCount: mongoClickCount },
    ]);
    expect(enriched[0].clickCount).toBe(15);

    // Background flush from enrichment updates MongoDB to 15 and clears Redis
    await flushPendingClicks(testCode);
    expect(mongoClickCount).toBe(15);
    expect(redisStore.get(`shorty:clicks:${testCode}`)).toBeUndefined();

    // 3. Cache expires, next request is a MISS through route handler
    redisStore.delete(`shorty:link:${testCode}`);
    const routeReq = new NextRequest(`https://shorty.sji.one/${testCode}`);
    await GET(routeReq, { params: Promise.resolve({ shortCode: testCode }) });

    // Exactly 1 additional increment on miss -> total 16
    expect(mongoClickCount).toBe(16);
  });

  // ── 10. Redis Failure Resilience ────────────────────────────────────────────
  it('Scenario 10: redirect and click tracking survive total Redis failure', async () => {
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...testLink }),
    } as any);

    // Simulate Redis REST failure
    (global.fetch as any).mockRejectedValueOnce(new Error('ECONNREFUSED: Redis offline'));

    // Proxy fails open and falls through
    const req = new NextRequest(`https://shorty.sji.one/${testCode}`);
    const proxyRes = await proxy(req);
    expect(proxyRes.headers.get('location')).toBeNull();

    // Route handler serves redirect via MongoDB and increments click
    const routeRes = await GET(req, { params: Promise.resolve({ shortCode: testCode }) });
    expect(routeRes.status).toBe(302);
    expect(routeRes.headers.get('location')).toBe(testLink.originalUrl);

    // MongoDB click recorded
    expect(Link.updateOne).toHaveBeenCalledWith(
      { _id: testLink._id },
      expect.objectContaining({
        $inc: { clickCount: 1 },
      }),
    );
  });
});

describe('Failure-Path & Reliability Tests (Requirements 1 to 8)', () => {
  const code = 'failrel1';
  const mockLink = {
    _id: 'mongo-fail-id-1',
    code,
    originalUrl: 'https://example.com/target-fail',
    isActive: true,
    expiresAt: null as Date | null,
    clickCount: 100,
  };

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    redisStore.clear();
    setupDefaultFetchMock();
    vi.clearAllMocks();
  });

  // 1. GETDEL succeeds + MongoDB succeeds
  it('1. GETDEL succeeds + MongoDB succeeds: claims pending counter, updates MongoDB, clears Redis', async () => {
    redisStore.set(`shorty:clicks:${code}`, 15);
    vi.mocked(Link.updateOne).mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

    const persisted = await flushPendingClicks(code);

    expect(persisted).toBe(15);
    expect(Link.updateOne).toHaveBeenCalledWith(
      { code },
      expect.objectContaining({
        $inc: { clickCount: 15 },
        $set: expect.objectContaining({ lastAccessedAt: expect.any(Date) }),
      }),
    );
    // Counter in Redis has been cleared
    expect(redisStore.get(`shorty:clicks:${code}`)).toBeUndefined();
  });

  // 2. GETDEL succeeds + MongoDB fails
  it('2. GETDEL succeeds + MongoDB fails: does not report clicks as durably persisted', async () => {
    redisStore.set(`shorty:clicks:${code}`, 17);
    vi.mocked(Link.updateOne).mockRejectedValue(new Error('MongoDB connection timeout'));

    const persisted = await flushPendingClicks(code);

    // Never report unpersisted clicks as durably persisted
    expect(persisted).toBe(0);
  });

  // 3. MongoDB fails + Redis counter is restored
  it('3. MongoDB fails + Redis counter is restored: restores claimed clicks via INCRBY', async () => {
    redisStore.set(`shorty:clicks:${code}`, 20);
    vi.mocked(Link.updateOne).mockRejectedValue(new Error('MongoDB write error'));

    const persisted = await flushPendingClicks(code);

    expect(persisted).toBe(0);
    expect(redis.incrby).toHaveBeenCalledWith(`shorty:clicks:${code}`, 20);
    // Redis store has the restored value
    expect(redisStore.get(`shorty:clicks:${code}`)).toBe(20);
  });

  // 4. Redis increment scheduled via waitUntil
  it('4. Redis increment scheduled via waitUntil: schedules INCR and returns 302 immediately without awaiting write', async () => {
    redisStore.set(`shorty:link:${code}`, {
      url: mockLink.originalUrl,
      isActive: true,
      expiresAt: null,
    });

    let scheduledPromise: Promise<any> | null = null;
    const mockEvent = {
      waitUntil: vi.fn((promise: Promise<any>) => {
        scheduledPromise = promise;
      }),
    };

    const req = new NextRequest(`https://shorty.sji.one/${code}`);
    const res = await proxy(req, mockEvent as any);

    // Immediate 302 redirect returned to user
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(mockLink.originalUrl);

    // waitUntil was called
    expect(mockEvent.waitUntil).toHaveBeenCalledTimes(1);
    expect(scheduledPromise).not.toBeNull();

    // Awaiting the scheduled task finishes the increment
    await scheduledPromise;
    expect(redisStore.get(`shorty:clicks:${code}`)).toBe(1);
  });

  // 5. Redis increment failure
  it('5. Redis increment failure: fetch rejection does not crash or block redirect', async () => {
    redisStore.set(`shorty:link:${code}`, {
      url: mockLink.originalUrl,
      isActive: true,
      expiresAt: null,
    });

    // Mock fetch to succeed for GET but reject for INCR
    (global.fetch as any).mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/get/')) {
        return {
          ok: true,
          json: async () => ({
            result: JSON.stringify({
              url: mockLink.originalUrl,
              isActive: true,
              expiresAt: null,
            }),
          }),
        };
      }
      if (urlStr.includes('/incr/')) {
        throw new Error('Redis connection refused');
      }
      return { ok: false };
    });

    let scheduledPromise: Promise<any> | null = null;
    const mockEvent = {
      waitUntil: vi.fn((p: Promise<any>) => {
        scheduledPromise = p;
      }),
    };

    const req = new NextRequest(`https://shorty.sji.one/${code}`);
    const res = await proxy(req, mockEvent as any);

    // Redirect succeeds without crashing
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(mockLink.originalUrl);

    // Background promise resolves gracefully without throwing unhandled rejection
    if (scheduledPromise) {
      await expect(scheduledPromise).resolves.not.toThrow();
    }
  });

  // 6. repeated concurrent Redis hits
  it('6. repeated concurrent Redis hits: accumulates all concurrent increments accurately', async () => {
    redisStore.set(`shorty:link:${code}`, {
      url: mockLink.originalUrl,
      isActive: true,
      expiresAt: null,
    });

    const concurrentRequests = 25;
    const promises = Array.from({ length: concurrentRequests }, async () => {
      const req = new NextRequest(`https://shorty.sji.one/${code}`);
      const res = await proxy(req);
      expect(res.status).toBe(302);
      return res;
    });

    await Promise.all(promises);

    // All 25 hits accounted for in Redis counter
    expect(redisStore.get(`shorty:clicks:${code}`)).toBe(25);
    expect(Link.updateOne).not.toHaveBeenCalled();
  });

  // 7. persistence retry
  it('7. persistence retry: restored clicks remain available and flush successfully on subsequent retry', async () => {
    redisStore.set(`shorty:clicks:${code}`, 30);

    // First attempt: MongoDB fails
    vi.mocked(Link.updateOne).mockRejectedValueOnce(new Error('Transient Mongo network glitch'));
    const firstFlush = await flushPendingClicks(code);
    expect(firstFlush).toBe(0);
    expect(redisStore.get(`shorty:clicks:${code}`)).toBe(30); // restored

    // Second attempt: MongoDB recovers
    vi.mocked(Link.updateOne).mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 } as any);
    const retryFlush = await flushPendingClicks(code);
    expect(retryFlush).toBe(30); // successfully persisted
    expect(Link.updateOne).toHaveBeenCalledWith(
      { code },
      expect.objectContaining({ $inc: { clickCount: 30 } }),
    );
    expect(redisStore.get(`shorty:clicks:${code}`)).toBeUndefined(); // cleared after success

    // Third attempt: nothing left to flush
    const thirdFlush = await flushPendingClicks(code);
    expect(thirdFlush).toBe(0);
  });

  // 8. no double counting after restoration
  it('8. no double counting after restoration: ensures counts are never decremented and no clicks lost or duplicated', async () => {
    let mongoDbClicks = 50;
    vi.mocked(Link.updateOne).mockImplementation(((query: any, update: any) => {
      if (update.$inc?.clickCount) {
        mongoDbClicks += update.$inc.clickCount;
      }
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 } as any);
    }) as any);

    // 1. Initial state: Mongo has 50, Redis gets 10 hits
    redisStore.set(`shorty:clicks:${code}`, 10);

    // 2. Flush fails -> 10 clicks restored to Redis
    vi.mocked(Link.updateOne).mockRejectedValueOnce(new Error('Mongo primary failover'));
    const failedFlush = await flushPendingClicks(code);
    expect(failedFlush).toBe(0);
    expect(mongoDbClicks).toBe(50); // unchanged
    expect(redisStore.get(`shorty:clicks:${code}`)).toBe(10); // restored

    // 3. 5 more clicks arrive while awaiting next flush
    await incrementClickCounter(code);
    await incrementClickCounter(code);
    await incrementClickCounter(code);
    await incrementClickCounter(code);
    await incrementClickCounter(code);
    expect(redisStore.get(`shorty:clicks:${code}`)).toBe(15);

    // 4. Enrichment correctly reports combined total (50 persisted + 15 pending = 65)
    // and triggers background flush to MongoDB
    const enriched = await enrichLinksWithPendingClicks([
      { code, clickCount: mongoDbClicks },
    ]);
    expect(enriched[0].clickCount).toBe(65);
    expect(enriched[0].persistedClicks).toBe(50);
    expect(enriched[0].pendingClicks).toBe(15);

    // Give background flush task a tick to complete
    await new Promise((r) => setTimeout(r, 10));

    // MongoDB now has all 15 clicks persisted: 50 + 15 = 65
    expect(mongoDbClicks).toBe(65);
    expect(redisStore.get(`shorty:clicks:${code}`)).toBeUndefined();

    // 5. Explicit flush now finds 0 remaining clicks — NO double counting
    const subsequentFlush = await flushPendingClicks(code);
    expect(subsequentFlush).toBe(0);
    expect(mongoDbClicks).toBe(65); // Remains strictly 65, never double-counted

    // 6. Next enrichment shows 65 persisted, 0 pending
    const subsequentEnrich = await enrichLinksWithPendingClicks([
      { code, clickCount: mongoDbClicks },
    ]);
    expect(subsequentEnrich[0].clickCount).toBe(65);
    expect(subsequentEnrich[0].persistedClicks).toBe(65);
    expect(subsequentEnrich[0].pendingClicks).toBe(0);
  });
});
