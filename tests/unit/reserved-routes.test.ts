import { describe, it, expect } from 'vitest';
import { isReservedCode, RESERVED_CODES } from '@/lib/config/reserved';

describe('isReservedCode', () => {
  it('returns true for "api"', () => expect(isReservedCode('api')).toBe(true));
  it('returns true for "admin"', () => expect(isReservedCode('admin')).toBe(true));
  it('returns true for "dashboard"', () => expect(isReservedCode('dashboard')).toBe(true));
  it('returns true for "login"', () => expect(isReservedCode('login')).toBe(true));
  it('returns true for "logout"', () => expect(isReservedCode('logout')).toBe(true));
  it('returns true for "signup"', () => expect(isReservedCode('signup')).toBe(true));
  it('returns true for "settings"', () => expect(isReservedCode('settings')).toBe(true));
  it('returns true for "about"', () => expect(isReservedCode('about')).toBe(true));
  it('returns true for "expired"', () => expect(isReservedCode('expired')).toBe(true));
  it('returns true for "disabled"', () => expect(isReservedCode('disabled')).toBe(true));
  it('returns true for "_next"', () => expect(isReservedCode('_next')).toBe(true));
  it('returns true for "not-found"', () => expect(isReservedCode('not-found')).toBe(true));

  it('is case-insensitive', () => {
    expect(isReservedCode('ADMIN')).toBe(true);
    expect(isReservedCode('Admin')).toBe(true);
    expect(isReservedCode('API')).toBe(true);
  });

  it('returns false for arbitrary codes', () => {
    expect(isReservedCode('abc1234')).toBe(false);
    expect(isReservedCode('mylink')).toBe(false);
    expect(isReservedCode('xK7pQwR')).toBe(false);
  });

  it('has a non-empty reserved set', () => {
    expect(RESERVED_CODES.size).toBeGreaterThan(10);
  });
});
