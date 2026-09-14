import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth, requireAdmin, isAdmin, requireOwnerOrAdmin } from '@/lib/auth/authorization';
import { auth } from '@/lib/auth/config';

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  ADMIN_EMAIL: 'admin@shorty.com',
}));

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves session when user is signed in', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'user@test.com', name: 'User', role: 'user' },
      expires: '2026-10-01',
    } as any);

    const session = await requireAuth();
    expect(session.user.id).toBe('u1');
  });

  it('throws AppError(401) when session is missing', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(requireAuth()).rejects.toThrow(/Authentication required/);
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves when signed-in user matches ADMIN_EMAIL', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin1', email: 'admin@shorty.com', name: 'Admin', role: 'admin' },
      expires: '2026-10-01',
    } as any);

    const session = await requireAdmin();
    expect(session.user.email).toBe('admin@shorty.com');
  });

  it('throws AppError(403) when user is not the admin', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u2', email: 'regular@test.com', name: 'Regular', role: 'user' },
      expires: '2026-10-01',
    } as any);

    await expect(requireAdmin()).rejects.toThrow(/Access denied/);
  });

  it('throws AppError(401) when user is not signed in', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(requireAdmin()).rejects.toThrow(/Authentication required/);
  });
});

describe('isAdmin', () => {
  it('returns true for admin user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin1', email: 'ADMIN@shorty.com', name: 'Admin', role: 'admin' },
      expires: '2026-10-01',
    } as any);

    expect(await isAdmin()).toBe(true);
  });

  it('returns false for non-admin user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u3', email: 'someone@test.com', name: 'Someone', role: 'user' },
      expires: '2026-10-01',
    } as any);

    expect(await isAdmin()).toBe(false);
  });
});

describe('requireOwnerOrAdmin', () => {
  it('allows resource owner', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'owner-id', email: 'owner@test.com', name: 'Owner', role: 'user' },
      expires: '2026-10-01',
    } as any);

    await expect(requireOwnerOrAdmin('owner-id')).resolves.toBeDefined();
  });

  it('allows admin even if not resource owner', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-id', email: 'admin@shorty.com', name: 'Admin', role: 'admin' },
      expires: '2026-10-01',
    } as any);

    await expect(requireOwnerOrAdmin('other-user-id')).resolves.toBeDefined();
  });

  it('throws AppError(403) for non-owner, non-admin user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'stranger-id', email: 'stranger@test.com', name: 'Stranger', role: 'user' },
      expires: '2026-10-01',
    } as any);

    await expect(requireOwnerOrAdmin('other-user-id')).rejects.toThrow(/Access denied/);
  });
});
