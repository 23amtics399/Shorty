import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/[shortCode]/route';
import { proxy } from '@/proxy';
import { Link } from '@/lib/db/models/Link';
import { setCachedLink, getCachedLink, invalidateCachedLink } from '@/lib/redis/cache';
import type { CachedLink } from '@/types';

// In-memory Redis simulation for lifecycle testing
const redisStore = new Map<string, CachedLink>();

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
  setCachedLink: vi.fn(async (code: string, data: CachedLink) => {
    redisStore.set(`shorty:link:${code}`, data);
  }),
  invalidateCachedLink: vi.fn(async (code: string) => {
    redisStore.delete(`shorty:link:${code}`);
  }),
}));

// Mock fetch in proxy.ts to read from the simulated redisStore and handle incr
global.fetch = vi.fn(async (url: string | URL | Request) => {
  const urlStr = url.toString();
  const match = urlStr.match(/\/get\/([^?]+)/);
  if (match) {
    const key = decodeURIComponent(match[1]);
    const val = redisStore.get(key);
    return {
      ok: true,
      json: async () => ({ result: val ? JSON.stringify(val) : null }),
    } as any;
  }
  const incrMatch = urlStr.match(/\/incr\/([^?]+)/);
  if (incrMatch) {
    return {
      ok: true,
      json: async () => ({ result: 1 }),
    } as any;
  }
  return { ok: false } as any;
});

describe('Integration — Full Redirect Lifecycle (Steps 1 to 14)', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    redisStore.clear();
    vi.clearAllMocks();
  });

  const testLink = {
    _id: 'mock-mongo-id-1',
    code: 'lifecycle1',
    originalUrl: 'https://example.com/v1',
    isActive: true,
    expiresAt: null as Date | null,
    clickCount: 0,
  };

  it('executes full 14-step redirect lifecycle correctly', async () => {
    // 1. Initial state: Link exists in MongoDB, not yet in Redis cache
    vi.mocked(Link.findOne).mockImplementation(
      () => ({ lean: vi.fn().mockResolvedValue(testLink) }) as any,
    );

    // 2. Request 1 through proxy: cache MISS -> falls through
    const proxyReq1 = new NextRequest('https://shorty.sji.one/lifecycle1');
    const proxyRes1 = await proxy(proxyReq1);
    expect(proxyRes1.headers.get('location')).toBeNull(); // fell through

    // 3. Request 1 reaches route handler -> MongoDB fallback -> HTTP 302 + sets Redis cache
    const routeReq1 = new NextRequest('https://shorty.sji.one/lifecycle1');
    const routeRes1 = await GET(routeReq1, { params: Promise.resolve({ shortCode: 'lifecycle1' }) });
    expect(routeRes1.status).toBe(302);
    expect(routeRes1.headers.get('location')).toBe('https://example.com/v1');
    expect(setCachedLink).toHaveBeenCalledWith(
      'lifecycle1',
      expect.objectContaining({ url: 'https://example.com/v1', isActive: true }),
    );

    // 4. Request 2 through proxy: Redis cache HIT -> fast-path 302 redirect
    const proxyReq2 = new NextRequest('https://shorty.sji.one/lifecycle1');
    const proxyRes2 = await proxy(proxyReq2);
    expect(proxyRes2.status).toBe(302);
    expect(proxyRes2.headers.get('location')).toBe('https://example.com/v1');

    // 5. Edit link destination in MongoDB & invalidate Redis cache
    testLink.originalUrl = 'https://example.com/v2-updated';
    await invalidateCachedLink('lifecycle1');
    expect(redisStore.has('shorty:link:lifecycle1')).toBe(false);

    // 6. Request after edit -> proxy misses -> route handler serves new URL and warms cache
    const routeRes2 = await GET(routeReq1, { params: Promise.resolve({ shortCode: 'lifecycle1' }) });
    expect(routeRes2.status).toBe(302);
    expect(routeRes2.headers.get('location')).toBe('https://example.com/v2-updated');

    // 7. Disable link (isActive: false) and invalidate
    testLink.isActive = false;
    await invalidateCachedLink('lifecycle1');

    // 8. Confirm proxy falls through and route handler returns HTTP 410 Gone
    const proxyRes3 = await proxy(new NextRequest('https://shorty.sji.one/lifecycle1'));
    expect(proxyRes3.headers.get('location')).toBeNull();

    const routeRes3 = await GET(routeReq1, { params: Promise.resolve({ shortCode: 'lifecycle1' }) });
    expect(routeRes3.status).toBe(410);
    const body410 = await routeRes3.text();
    expect(body410).toContain('Link Disabled');

    // 9. Re-enable link (isActive: true)
    testLink.isActive = true;
    await invalidateCachedLink('lifecycle1');

    // 10. Confirm redirect works again (HTTP 302)
    const routeRes4 = await GET(routeReq1, { params: Promise.resolve({ shortCode: 'lifecycle1' }) });
    expect(routeRes4.status).toBe(302);
    expect(routeRes4.headers.get('location')).toBe('https://example.com/v2-updated');

    // 11. Delete link (not found in MongoDB)
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as any);
    await invalidateCachedLink('lifecycle1');

    // 12. Confirm HTTP 404 Not Found
    const routeRes5 = await GET(routeReq1, { params: Promise.resolve({ shortCode: 'lifecycle1' }) });
    expect(routeRes5.status).toBe(404);
    const body404 = await routeRes5.text();
    expect(body404).toContain('Link Not Found');

    // 13. Expire a link (expiresAt in the past)
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...testLink,
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago
      }),
    } as any);

    // 14. Confirm HTTP 410 Gone
    const routeRes6 = await GET(routeReq1, { params: Promise.resolve({ shortCode: 'lifecycle1' }) });
    expect(routeRes6.status).toBe(410);
    const bodyExpired = await routeRes6.text();
    expect(bodyExpired).toContain('Link Expired');
  });
});
