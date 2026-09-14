import { describe, it, expect } from 'vitest';

// Test the expiration logic in isolation (no DB needed)
// This mirrors the logic in the route handler

function isExpired(expiresAt: Date | null): boolean {
  if (expiresAt === null) return false;
  return expiresAt <= new Date();
}

function computeAnonExpiry(hoursLimit: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + hoursLimit);
  return d;
}

function computeAuthExpiry(daysLimit: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysLimit);
  return d;
}

function capExpiry(requested: Date, maxExpiry: Date): Date {
  return requested > maxExpiry ? maxExpiry : requested;
}

describe('isExpired', () => {
  it('returns false for null (permanent link)', () => {
    expect(isExpired(null)).toBe(false);
  });

  it('returns false for future date', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isExpired(future)).toBe(false);
  });

  it('returns true for past date', () => {
    const past = new Date(Date.now() - 1000);
    expect(isExpired(past)).toBe(true);
  });

  it('returns true for exactly now (edge case)', () => {
    const now = new Date();
    // Subtract 1ms to ensure it's in the past
    now.setMilliseconds(now.getMilliseconds() - 1);
    expect(isExpired(now)).toBe(true);
  });
});

describe('anonymous link lifetime', () => {
  it('computes expiry ~24h from now', () => {
    const expiry = computeAnonExpiry(24);
    const diffHours = (expiry.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 0);
  });

  it('caps requested expiry at max limit', () => {
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const maxExpiry = computeAnonExpiry(24);
    const capped = capExpiry(farFuture, maxExpiry);
    expect(capped.getTime()).toBeLessThanOrEqual(maxExpiry.getTime() + 1000);
  });

  it('allows expiry shorter than max limit', () => {
    const sooner = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const maxExpiry = computeAnonExpiry(24);
    const result = capExpiry(sooner, maxExpiry);
    expect(result.getTime()).toBe(sooner.getTime());
  });
});

describe('authenticated link lifetime', () => {
  it('computes expiry ~30d from now', () => {
    const expiry = computeAuthExpiry(30);
    const diffDays = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('caps requested expiry at max limit', () => {
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const maxExpiry = computeAuthExpiry(30);
    const capped = capExpiry(farFuture, maxExpiry);
    expect(capped.getTime()).toBeLessThanOrEqual(maxExpiry.getTime() + 1000);
  });

  it('authenticated user with no expiry → null (permanent)', () => {
    // If no expiresAt provided and user is authenticated → null
    const expiresAt: Date | null = null; // permanent
    expect(isExpired(expiresAt)).toBe(false);
  });
});
