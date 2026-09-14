import { describe, it, expect } from 'vitest';
import { generateShortCode } from '@/lib/shortcode/generate';

describe('generateShortCode', () => {
  const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  it('generates a code of the default length (7)', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(7);
  });

  it('generates a code of a custom length', () => {
    expect(generateShortCode(4)).toHaveLength(4);
    expect(generateShortCode(10)).toHaveLength(10);
  });

  it('only contains Base62 characters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateShortCode();
      for (const char of code) {
        expect(BASE62).toContain(char);
      }
    }
  });

  it('generates different codes each time', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateShortCode()));
    // With 62^7 ≈ 3.5 trillion possibilities, all 100 should be unique
    expect(codes.size).toBe(100);
  });
});

describe('generateUniqueCode', () => {
  it('returns a code that does not exist', async () => {
    const { generateUniqueCode } = await import('@/lib/shortcode/generate');
    const existing = new Set(['abc1234']);
    const code = await generateUniqueCode(async (c) => existing.has(c));
    expect(code).not.toBe('abc1234');
    expect(code).toHaveLength(7);
  });

  it('retries on collision', async () => {
    const { generateUniqueCode } = await import('@/lib/shortcode/generate');
    let callCount = 0;
    // First 3 calls return "taken", 4th is free
    const code = await generateUniqueCode(async () => {
      callCount++;
      return callCount < 4;
    });
    expect(callCount).toBeGreaterThanOrEqual(4);
    expect(code).toBeDefined();
  });

  it('throws after max retries', async () => {
    const { generateUniqueCode } = await import('@/lib/shortcode/generate');
    await expect(generateUniqueCode(async () => true)).rejects.toThrow(
      'Failed to generate unique short code',
    );
  });
});
