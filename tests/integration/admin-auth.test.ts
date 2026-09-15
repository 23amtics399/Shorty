import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAdminReports } from '@/app/api/v1/admin/reports/route';
import { GET as getAdminLinks } from '@/app/api/v1/admin/links/route';
import { auth } from '@/lib/auth/config';

// Mock DB connections and models
vi.mock('@/lib/db/mongodb', () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

const mockReports = [
  { _id: 'rep-1', shortCode: 'bad1', reason: 'malware', status: 'pending', createdAt: new Date() },
];

const mockLinks = [
  { _id: 'link-1', code: 'code1', originalUrl: 'https://example.com', isActive: true, createdAt: new Date() },
];

vi.mock('@/lib/db/models/Report', () => ({
  Report: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        skip: vi.fn(() => ({
          limit: vi.fn(() => ({
            lean: vi.fn().mockResolvedValue(mockReports),
          })),
        })),
      })),
    })),
    countDocuments: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/lib/db/models/Link', () => ({
  Link: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        skip: vi.fn(() => ({
          limit: vi.fn(() => ({
            lean: vi.fn().mockResolvedValue(mockLinks),
          })),
        })),
      })),
    })),
    countDocuments: vi.fn().mockResolvedValue(1),
  },
}));

// Mock Auth.js
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/redis/clicks', () => ({
  enrichLinksWithPendingClicks: vi.fn((links) => Promise.resolve(links)),
}));

describe('Integration — Admin Authorization Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAIL = 'admin@sji.one';
  });

  // ─── GET /api/v1/admin/reports ───────────────────────────────────────────────

  describe('GET /api/v1/admin/reports', () => {
    it('rejects unauthenticated requests with HTTP 401 Unauthorized', async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      const req = new NextRequest('https://shorty.sji.one/api/v1/admin/reports');
      const res = await getAdminReports(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('UNAUTHORIZED');
      expect(body.error).toBe('Authentication required');
    });

    it('rejects authenticated non-admin users with HTTP 403 Forbidden', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'usr-1', email: 'regularuser@example.com', name: 'Regular User' },
        expires: '2099-01-01',
      } as any);

      const req = new NextRequest('https://shorty.sji.one/api/v1/admin/reports');
      const res = await getAdminReports(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
      expect(body.error).toBe('Access denied');
    });

    it('grants access with HTTP 200 to verified admin user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-1', email: 'admin@sji.one', name: 'Admin User' },
        expires: '2099-01-01',
      } as any);

      const req = new NextRequest('https://shorty.sji.one/api/v1/admin/reports?status=pending');
      const res = await getAdminReports(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reports).toHaveLength(1);
      expect(body.reports[0].shortCode).toBe('bad1');
      expect(body.pagination.total).toBe(1);
    });

    it('matches admin email case-insensitively', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-1', email: 'ADMIN@SJI.ONE', name: 'Admin User' },
        expires: '2099-01-01',
      } as any);

      const req = new NextRequest('https://shorty.sji.one/api/v1/admin/reports');
      const res = await getAdminReports(req);

      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/v1/admin/links ─────────────────────────────────────────────────

  describe('GET /api/v1/admin/links', () => {
    it('rejects unauthenticated requests with HTTP 401 Unauthorized', async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      const req = new NextRequest('https://shorty.sji.one/api/v1/admin/links');
      const res = await getAdminLinks(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('rejects authenticated non-admin users with HTTP 403 Forbidden', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'usr-2', email: 'hacker@malicious.com', name: 'Intruder' },
        expires: '2099-01-01',
      } as any);

      const req = new NextRequest('https://shorty.sji.one/api/v1/admin/links');
      const res = await getAdminLinks(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    it('grants access with HTTP 200 to verified admin user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-1', email: 'admin@sji.one', name: 'Admin User' },
        expires: '2099-01-01',
      } as any);

      const req = new NextRequest('https://shorty.sji.one/api/v1/admin/links?search=code1');
      const res = await getAdminLinks(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.links).toHaveLength(1);
      expect(body.links[0].code).toBe('code1');
      expect(body.pagination.page).toBe(1);
    });
  });
});
