import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { GET } from '@/app/[shortCode]/route';
import { POST } from '@/app/api/v1/links/route';
import { connectToDatabase } from '@/lib/db/mongodb';

// Mock MongoDB to simulate connection outage
vi.mock('@/lib/db/mongodb', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/db/models/Link', () => ({
  Link: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
  },
}));

// Mock Auth
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// Mock Rate limiting so it doesn't block the link creation test
vi.mock('@/lib/redis/ratelimit', () => ({
  rateLimitAnonCreate: vi.fn().mockResolvedValue({ success: true, remaining: 5, reset: Date.now() + 3600000 }),
  rateLimitUserCreate: vi.fn().mockResolvedValue({ success: true, remaining: 50, reset: Date.now() + 3600000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

// Mock logger to verify error logging without polluting stdout
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// In-memory Redis simulation for proxy fast path
const redisStore = new Map<string, string>();

global.fetch = vi.fn(async (url: string | URL | Request) => {
  const urlStr = url.toString();
  const match = urlStr.match(/\/get\/([^?]+)/);
  if (match) {
    const key = decodeURIComponent(match[1]);
    const val = redisStore.get(key);
    return {
      ok: true,
      json: async () => ({ result: val ?? null }),
    } as any;
  }
  return { ok: false } as any;
});

describe('Integration — Simulated MongoDB Outage Resilience', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    redisStore.clear();
    vi.clearAllMocks();

    // Default: MongoDB connection failure (outage)
    vi.mocked(connectToDatabase).mockRejectedValue(
      new Error('MongoServerSelectionError: Server selection timed out after 5000 ms; uri=mongodb+srv://user:secretpass@cluster0.mongodb.net/shorty'),
    );
  });

  it('serves cached link redirects (HTTP 302) via Redis fast path even when MongoDB is completely offline', async () => {
    // 1. Populate Redis with a cached link
    redisStore.set(
      'shorty:link:fastcached',
      JSON.stringify({
        url: 'https://example.com/cached-during-outage',
        isActive: true,
        expiresAt: null,
      }),
    );

    // 2. Client requests the cached link
    const req = new NextRequest('https://shorty.sji.one/fastcached');
    const res = await proxy(req);

    // 3. Must return HTTP 302 without touching MongoDB
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/cached-during-outage');
    expect(connectToDatabase).not.toHaveBeenCalled();
  });

  it('handles cache miss during MongoDB outage safely without exposing connection strings or stack traces', async () => {
    // 1. Proxy misses and falls through
    const proxyReq = new NextRequest('https://shorty.sji.one/uncached1');
    const proxyRes = await proxy(proxyReq);
    expect(proxyRes.headers.get('location')).toBeNull(); // fell through to route handler

    // 2. Route handler attempts DB resolution during outage
    const routeReq = new NextRequest('https://shorty.sji.one/uncached1', {
      headers: { Accept: 'application/json' },
    });
    const routeRes = await GET(routeReq, { params: Promise.resolve({ shortCode: 'uncached1' }) });

    // 3. Returns safe error response
    expect(routeRes.status).toBe(404);
    const body = await routeRes.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.error).toBe('The requested link could not be resolved at this time.');

    // 4. Verify no sensitive MongoDB secrets leaked in body
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('mongodb');
    expect(bodyStr).not.toContain('secretpass');
    expect(bodyStr).not.toContain('MongoServerSelectionError');
    expect(bodyStr).not.toContain('stack');
  });

  it('handles HTML client cache miss during MongoDB outage with branded status page', async () => {
    const routeReq = new NextRequest('https://shorty.sji.one/uncached2', {
      headers: { Accept: 'text/html' },
    });
    const routeRes = await GET(routeReq, { params: Promise.resolve({ shortCode: 'uncached2' }) });

    expect(routeRes.status).toBe(404);
    const html = await routeRes.text();
    expect(html).toContain('Link Unavailable');
    expect(html).toContain('The requested link could not be resolved at this time.');
    expect(html).not.toContain('mongodb+srv');
    expect(html).not.toContain('secretpass');
  });

  it('fails safely with HTTP 500 when link creation is attempted during MongoDB outage', async () => {
    const req = new NextRequest('https://shorty.sji.one/api/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/test' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.code).toBe('INTERNAL_ERROR');
    expect(json.error).toBe('Internal server error');

    // Verify no secret leak
    const jsonStr = JSON.stringify(json);
    expect(jsonStr).not.toContain('secretpass');
    expect(jsonStr).not.toContain('cluster0');
  });
});
