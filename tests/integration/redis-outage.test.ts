import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { GET } from '@/app/[shortCode]/route';
import { POST as createLinkPOST } from '@/app/api/v1/links/route';
import { POST as signupPOST } from '@/app/api/auth/signup/route';
import { Link } from '@/lib/db/models/Link';
import { redis } from '@/lib/redis/client';

vi.mock('@/lib/db/mongodb', () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db/models/Link', () => ({
  Link: {
    findOne: vi.fn(),
    create: vi.fn(),
    exists: vi.fn(),
    updateOne: vi.fn().mockReturnValue(Promise.resolve()),
  },
}));

vi.mock('@/lib/db/models/User', () => ({
  User: {
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/redis/client', () => ({
  redis: {
    incr: vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Redis cluster unreachable')),
    expire: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    ttl: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    set: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    del: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  },
}));

// Simulate proxy fetch failing
global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused to Upstash'));

describe('Integration — Simulated Redis Outage Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects continue through MongoDB when Redis is completely down', async () => {
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        code: 'fallback1',
        originalUrl: 'https://example.com/target',
        isActive: true,
        expiresAt: null,
      }),
    } as any);

    // 1. Proxy fails to reach Redis -> fails open without crashing
    const proxyReq = new NextRequest('https://shorty.sji.one/fallback1');
    const proxyRes = await proxy(proxyReq);
    expect(proxyRes.headers.get('location')).toBeNull(); // successfully fell through

    // 2. Route handler handles MongoDB lookup -> returns 302 redirect
    const routeReq = new NextRequest('https://shorty.sji.one/fallback1');
    const routeRes = await GET(routeReq, { params: Promise.resolve({ shortCode: 'fallback1' }) });
    expect(routeRes.status).toBe(302);
    expect(routeRes.headers.get('location')).toBe('https://example.com/target');
  });

  it('authentication strictly FAILS CLOSED during Redis outage (no bypass of brute force protection)', async () => {
    const signupReq = new NextRequest('https://shorty.sji.one/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '185.220.101.5',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const res = await signupPOST(signupReq);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.code).toBe('SERVICE_UNAVAILABLE');
    expect(json.error).toMatch(/temporarily unavailable/i);
    // Ensure no internal connection stack traces are exposed
    expect(json.error).not.toMatch(/ECONNREFUSED/);
  });

  it('anonymous link creation applies conservative emergency fallback, then fails closed', async () => {
    vi.mocked(Link.exists).mockResolvedValue(null as any);
    vi.mocked(Link.create).mockResolvedValue({
      code: 'code123',
      originalUrl: 'https://example.com',
      expiresAt: new Date(),
    } as any);

    const testIp = '198.51.100.42';

    const makeReq = () =>
      new NextRequest('https://shorty.sji.one/api/v1/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': testIp,
        },
        body: JSON.stringify({ url: 'https://example.com' }),
      });

    // 1st request: allowed under conservative quota
    const res1 = await createLinkPOST(makeReq());
    expect(res1.status).toBe(201);

    // 2nd request: allowed under conservative quota
    const res2 = await createLinkPOST(makeReq());
    expect(res2.status).toBe(201);

    // 3rd request: conservative limit reached -> fails closed with HTTP 429
    const res3 = await createLinkPOST(makeReq());
    expect(res3.status).toBe(429);
    const json3 = await res3.json();
    expect(json3.code).toBe('RATE_LIMITED');
    expect(json3.error).not.toMatch(/ECONNREFUSED/);
  });
});
