import { describe, it, expect } from 'vitest';
import { validateAlias } from '@/lib/shortcode/validate';

describe('validateAlias', () => {
  // ── Valid aliases ───────────────────────────────────────────────────────────
  it('accepts valid alphanumeric alias', () => {
    expect(validateAlias('mylink').valid).toBe(true);
  });

  it('accepts alias with hyphen', () => {
    expect(validateAlias('my-link').valid).toBe(true);
  });

  it('accepts alias with underscore', () => {
    expect(validateAlias('my_link').valid).toBe(true);
  });

  it('accepts alias at min length (3)', () => {
    expect(validateAlias('abc').valid).toBe(true);
  });

  it('accepts alias at max length (50)', () => {
    expect(validateAlias('a'.repeat(50)).valid).toBe(true);
  });

  it('accepts uppercase', () => {
    expect(validateAlias('MyLink').valid).toBe(true);
  });

  // ── Length validation ───────────────────────────────────────────────────────
  it('rejects alias too short (< 3 chars)', () => {
    const result = validateAlias('ab');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 3');
  });

  it('rejects alias too long (> 50 chars)', () => {
    const result = validateAlias('a'.repeat(51));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at most 50');
  });

  it('rejects empty alias', () => {
    expect(validateAlias('').valid).toBe(false);
    expect(validateAlias('   ').valid).toBe(false);
  });

  // ── Character validation ────────────────────────────────────────────────────
  it('rejects alias with space', () => {
    expect(validateAlias('my link').valid).toBe(false);
  });

  it('rejects alias with special characters', () => {
    expect(validateAlias('my@link').valid).toBe(false);
    expect(validateAlias('my/link').valid).toBe(false);
    expect(validateAlias('my.link').valid).toBe(false);
  });

  // ── Reserved codes ──────────────────────────────────────────────────────────
  it('rejects reserved code "api"', () => {
    const result = validateAlias('api');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('reserved');
  });

  it('rejects reserved code "admin"', () => {
    expect(validateAlias('admin').valid).toBe(false);
  });

  it('rejects reserved code "dashboard"', () => {
    expect(validateAlias('dashboard').valid).toBe(false);
  });

  it('rejects reserved code case-insensitively', () => {
    expect(validateAlias('Admin').valid).toBe(false);
    expect(validateAlias('API').valid).toBe(false);
  });
});
