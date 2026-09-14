import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/links/route';
import { auth } from '@/lib/auth/config';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Link } from '@/lib/db/models/Link';

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/mongodb', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/db/models/Link', () => ({
  Link: {
    create: vi.fn(),
    exists: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('@/lib/redis/ratelimit', () => ({
  rateLimitAnonCreate: vi.fn().mockResolvedValue(undefined),
  rateLimitUserCreate: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('POST /api/v1/links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null as any);
  });

  it('rejects invalid JSON body with 400 Bad Request', async () => {
    const req = new NextRequest('https://shorty.sji.one/api/v1/links', {
      method: 'POST',
      body: 'invalid-json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid JSON body/);
  });

  it('rejects invalid URL schemes (javascript:, file:)', async () => {
    const req = new NextRequest('https://shorty.sji.one/api/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/protocol/i);
  });

  it('blocks private IP addresses (SSRF protection)', async () => {
    const req = new NextRequest('https://shorty.sji.one/api/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://192.168.1.1/admin' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/private network/i);
  });

  it('rejects custom aliases for anonymous users', async () => {
    const req = new NextRequest('https://shorty.sji.one/api/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        customAlias: 'my-alias',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Custom aliases require an account/);
  });

  it('creates short link successfully for valid request', async () => {
    vi.mocked(Link.exists).mockResolvedValue(null as any);
    vi.mocked(Link.create).mockResolvedValue({
      code: 'xyz1234',
      originalUrl: 'https://example.com',
      expiresAt: new Date(),
    } as any);

    const req = new NextRequest('https://shorty.sji.one/api/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.code).toBe('xyz1234');
    expect(data.shortUrl).toContain('xyz1234');
  });
});
