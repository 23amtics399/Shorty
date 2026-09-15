import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/[shortCode]/route';
import { Link } from '@/lib/db/models/Link';
import { setCachedLink } from '@/lib/redis/cache';

vi.mock('@/lib/db/mongodb', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/db/models/Link', () => ({
  Link: {
    findOne: vi.fn(),
    updateOne: vi.fn().mockReturnValue(Promise.resolve()),
  },
}));

vi.mock('@/lib/redis/cache', () => ({
  setCachedLink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/redis/clicks', () => ({
  getAndResetPendingClicks: vi.fn().mockResolvedValue(0),
  restorePendingClicks: vi.fn().mockResolvedValue(undefined),
}));

describe('GET /[shortCode] Route Handler — HTTP Semantics Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Link.updateOne).mockReturnValue(Promise.resolve() as any);
  });

  it('returns HTTP 404 (Not Found) when link does not exist', async () => {
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as any);

    const req = new NextRequest('https://shorty.sji.one/nonexistent');
    const params = Promise.resolve({ shortCode: 'nonexistent' });

    const res = await GET(req, { params });
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain('Link Not Found');
    expect(body).toContain('HTTP 404');
    expect(res.headers.get('location')).toBeNull();
  });

  it('returns HTTP 410 (Gone) when link isActive is false', async () => {
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        code: 'paused1',
        originalUrl: 'https://example.com',
        isActive: false,
        expiresAt: null,
      }),
    } as any);

    const req = new NextRequest('https://shorty.sji.one/paused1');
    const params = Promise.resolve({ shortCode: 'paused1' });

    const res = await GET(req, { params });
    expect(res.status).toBe(410);
    const body = await res.text();
    expect(body).toContain('Link Disabled');
    expect(body).toContain('HTTP 410');
    expect(res.headers.get('location')).toBeNull();
  });

  it('returns HTTP 410 (Gone) when link expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        code: 'oldlink',
        originalUrl: 'https://example.com',
        isActive: true,
        expiresAt: pastDate,
      }),
    } as any);

    const req = new NextRequest('https://shorty.sji.one/oldlink');
    const params = Promise.resolve({ shortCode: 'oldlink' });

    const res = await GET(req, { params });
    expect(res.status).toBe(410);
    const body = await res.text();
    expect(body).toContain('Link Expired');
    expect(body).toContain('HTTP 410');
    expect(res.headers.get('location')).toBeNull();
  });

  it('returns JSON response for API clients requesting application/json', async () => {
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as any);

    const req = new NextRequest('https://shorty.sji.one/nonexistent', {
      headers: { Accept: 'application/json' },
    });
    const params = Promise.resolve({ shortCode: 'nonexistent' });

    const res = await GET(req, { params });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('NOT_FOUND');
    expect(json.error).toMatch(/Link Not Found/i);
  });

  it('returns HTTP 302 and sets Redis cache for valid active link', async () => {
    vi.mocked(Link.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        code: 'valid1',
        originalUrl: 'https://github.com/trending',
        isActive: true,
        expiresAt: null,
      }),
    } as any);

    const req = new NextRequest('https://shorty.sji.one/valid1');
    const params = Promise.resolve({ shortCode: 'valid1' });

    const res = await GET(req, { params });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://github.com/trending');
    expect(setCachedLink).toHaveBeenCalledWith(
      'valid1',
      expect.objectContaining({
        url: 'https://github.com/trending',
        isActive: true,
      }),
    );
  });
});
