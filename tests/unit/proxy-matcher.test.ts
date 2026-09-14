import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

// Mock fetch for redisGet in proxy.ts
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('src/proxy.ts — Route Segregation and Path Normalization Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
  });

  // ─── Positive Cases: Valid Short Codes ──────────────────────────────────────

  it('performs Redis lookup and redirects on cache HIT for canonical short codes', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/get/')) {
        return {
          ok: true,
          json: async () => ({
            result: JSON.stringify({
              url: 'https://github.com/trending',
              isActive: true,
              expiresAt: null,
            }),
          }),
        } as any;
      }
      if (urlStr.includes('/incr/')) {
        return { ok: true, json: async () => ({ result: 1 }) } as any;
      }
      return { ok: false } as any;
    });

    const req = new NextRequest('https://shorty.sji.one/jk7ien');
    const res = await proxy(req);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/get/shorty%3Alink%3Ajk7ien'),
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/incr/shorty%3Aclicks%3Ajk7ien'),
      expect.any(Object),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://github.com/trending');
  });

  it('supports alphanumeric, hyphen, and underscore short codes', async () => {
    const codes = ['a8Kx92', 'my-alias', '1234567', 'promo_2026'];

    for (const code of codes) {
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/get/')) {
          return {
            ok: true,
            json: async () => ({
              result: JSON.stringify({
                url: `https://example.com/${code}`,
                isActive: true,
                expiresAt: null,
              }),
            }),
          } as any;
        }
        if (urlStr.includes('/incr/')) {
          return { ok: true, json: async () => ({ result: 1 }) } as any;
        }
        return { ok: false } as any;
      });

      const req = new NextRequest(`https://shorty.sji.one/${code}`);
      const res = await proxy(req);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/get/shorty%3Alink%3A${code}`),
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/incr/shorty%3Aclicks%3A${code}`),
        expect.any(Object),
      );
      expect(res.status).toBe(302);
    }
  });

  // ─── Negative Cases: Application & Reserved Routes Must Never Query Redis ────

  it('never performs Redis lookup on homepage (/)', async () => {
    const req = new NextRequest('https://shorty.sji.one/');
    await proxy(req);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('never performs Redis lookup on reserved application routes', async () => {
    const reserved = [
      'about',
      'features',
      'pricing',
      'developers',
      'help',
      'report',
      'privacy',
      'terms',
      'login',
      'signup',
      'dashboard',
      'admin',
      'api',
      'expired',
      'disabled',
      'not-found',
      'status',
      'health',
      'robots.txt',
      'sitemap.xml',
      'favicon.ico',
    ];

    for (const path of reserved) {
      mockFetch.mockReset();
      const req = new NextRequest(`https://shorty.sji.one/${path}`);
      await proxy(req);
      expect(mockFetch).not.toHaveBeenCalled();
    }
  });

  // ─── Security Audit: Malformed Paths & Traversal Attempts ───────────────────

  it('does NOT silently normalize multiple leading slashes (///code)', async () => {
    const malformed = [
      '//jk7ien',
      '///jk7ien',
      '////a8Kx92',
    ];

    for (const path of malformed) {
      mockFetch.mockReset();
      const req = new NextRequest(`https://shorty.sji.one${path}`);
      await proxy(req);
      expect(mockFetch).not.toHaveBeenCalled();
    }
  });

  it('rejects path traversal and encoded traversal attempts without Redis lookup', async () => {
    const attacks = [
      '/..%2fjk7ien',
      '/..',
      '/jk7ien/..',
      '/%2e%2e%2fcode',
      '/%2e%2e',
      '/code%2fadmin',
      '/%5cadmin',
      '/code\\admin',
    ];

    for (const attack of attacks) {
      mockFetch.mockReset();
      const req = new NextRequest(`https://shorty.sji.one${attack}`);
      await proxy(req);
      expect(mockFetch).not.toHaveBeenCalled();
    }
  });

  it('rejects nested paths and trailing slashes without Redis lookup', async () => {
    const nested = [
      '/jk7ien/',
      '/jk7ien/stats',
      '/a/b/c',
    ];

    for (const path of nested) {
      mockFetch.mockReset();
      const req = new NextRequest(`https://shorty.sji.one${path}`);
      await proxy(req);
      expect(mockFetch).not.toHaveBeenCalled();
    }
  });

  it('rejects invalid characters and excessively long codes (> 50 chars)', async () => {
    const invalid = [
      '/@invalid',
      '/has!mark',
      '/has$dollar',
      '/' + 'a'.repeat(51),
    ];

    for (const path of invalid) {
      mockFetch.mockReset();
      const req = new NextRequest(`https://shorty.sji.one${path}`);
      await proxy(req);
      expect(mockFetch).not.toHaveBeenCalled();
    }
  });

  // ─── Cache State Semantics: Fall Through on Disabled or Expired ─────────────

  it('falls through to route handler when cached link is disabled (no 302)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: JSON.stringify({
          url: 'https://example.com',
          isActive: false,
          expiresAt: null,
        }),
      }),
    });

    const req = new NextRequest('https://shorty.sji.one/disabled-link');
    const res = await proxy(req);

    // Must NOT return 302 redirect — falls through for route handler to return 410 Gone
    expect(res.headers.get('location')).toBeNull();
  });

  it('falls through to route handler when cached link is expired (no 302)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: JSON.stringify({
          url: 'https://example.com',
          isActive: true,
          expiresAt: Date.now() - 10000, // expired 10 seconds ago
        }),
      }),
    });

    const req = new NextRequest('https://shorty.sji.one/expired-link');
    const res = await proxy(req);

    // Must NOT return 302 redirect — falls through for route handler to return 410 Gone
    expect(res.headers.get('location')).toBeNull();
  });
});
