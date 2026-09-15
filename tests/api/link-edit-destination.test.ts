import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/v1/links/[id]/route';
import { auth } from '@/lib/auth/config';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Link } from '@/lib/db/models/Link';
import { invalidateCachedLink } from '@/lib/redis/cache';
import mongoose from 'mongoose';

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/mongodb', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/db/models/Link', () => ({
  Link: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('@/lib/redis/cache', () => ({
  invalidateCachedLink: vi.fn().mockResolvedValue(undefined),
}));

describe('PUT /api/v1/links/[id] — Destination Editing', () => {
  const validMongoId = new mongoose.Types.ObjectId().toString();
  const ownerId = new mongoose.Types.ObjectId().toString();

  const mockExistingLink = {
    _id: validMongoId,
    code: 'target123',
    originalUrl: 'https://example.com/old-destination',
    isActive: true,
    expiresAt: null,
    ownerId,
    ownerType: 'user',
    clickCount: 42,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows owner to update destination URL and invalidates cache', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: ownerId, email: 'owner@example.com', role: 'user' },
    } as any);

    vi.mocked(Link.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockExistingLink),
    } as any);

    const newDestination = 'https://example.com/new-brand-destination';
    vi.mocked(Link.findByIdAndUpdate).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...mockExistingLink,
        originalUrl: newDestination,
      }),
    } as any);

    const req = new NextRequest(`https://shorty.sji.one/api/v1/links/${validMongoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newDestination }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: validMongoId }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.originalUrl).toBe(newDestination);

    // Verify DB update called with normalized URL
    expect(Link.findByIdAndUpdate).toHaveBeenCalledWith(
      validMongoId,
      { $set: { originalUrl: newDestination } },
      { new: true },
    );

    // Verify Redis cache was invalidated for short code
    expect(invalidateCachedLink).toHaveBeenCalledWith('target123');
  });

  it('rejects update if caller is not the owner (403 Forbidden)', async () => {
    const nonOwnerId = new mongoose.Types.ObjectId().toString();
    vi.mocked(auth).mockResolvedValue({
      user: { id: nonOwnerId, email: 'attacker@example.com', role: 'user' },
    } as any);

    vi.mocked(Link.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockExistingLink),
    } as any);

    const req = new NextRequest(`https://shorty.sji.one/api/v1/links/${validMongoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hacked' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: validMongoId }) });
    expect(res.status).toBe(403);
    expect(Link.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(invalidateCachedLink).not.toHaveBeenCalled();
  });

  it('rejects invalid or unsafe destination URLs with 400 Bad Request', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: ownerId, email: 'owner@example.com', role: 'user' },
    } as any);

    vi.mocked(Link.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockExistingLink),
    } as any);

    const unsafeUrls = [
      'javascript:alert(1)',
      'data:text/html,evil',
      'http://127.0.0.1:8080',
      'http://192.168.1.1/router',
      'not-a-url',
    ];

    for (const badUrl of unsafeUrls) {
      const req = new NextRequest(`https://shorty.sji.one/api/v1/links/${validMongoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: badUrl }),
      });

      const res = await PUT(req, { params: Promise.resolve({ id: validMongoId }) });
      expect(res.status).toBe(400);
      expect(Link.findByIdAndUpdate).not.toHaveBeenCalled();
    }
  });
});
