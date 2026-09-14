/**
 * Short code generation using cryptographically secure random bytes.
 * Produces a Base62 string (a-z, A-Z, 0-9) of the configured length.
 */

import { randomBytes } from 'crypto';
import { SHORT_CODE_LENGTH, SHORT_CODE_MAX_RETRIES } from '@/lib/config';

const BASE62_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE62_LENGTH = BASE62_CHARSET.length; // 62

/**
 * Generate a single random Base62 string of the specified length.
 * Uses rejection sampling to avoid modulo bias.
 */
export function generateShortCode(length: number = SHORT_CODE_LENGTH): string {
  const bytes = randomBytes(length * 2); // extra bytes for rejection sampling
  let result = '';
  let byteIndex = 0;

  while (result.length < length) {
    if (byteIndex >= bytes.length) {
      // Regenerate if we ran out (very rare)
      return generateShortCode(length);
    }
    const byte = bytes[byteIndex++];
    // Rejection sampling: only use bytes < 248 (248 = floor(256/62)*62)
    // This ensures uniform distribution
    if (byte < 248) {
      result += BASE62_CHARSET[byte % BASE62_LENGTH];
    }
  }

  return result;
}

/**
 * Generate a short code that doesn't exist in the database.
 * Retries up to SHORT_CODE_MAX_RETRIES times.
 *
 * @param exists - async function that returns true if a code is already taken
 */
export async function generateUniqueCode(
  exists: (code: string) => Promise<boolean>,
  length: number = SHORT_CODE_LENGTH,
): Promise<string> {
  for (let attempt = 0; attempt < SHORT_CODE_MAX_RETRIES; attempt++) {
    const code = generateShortCode(length);
    if (!(await exists(code))) {
      return code;
    }
  }
  throw new Error(
    `Failed to generate unique short code after ${SHORT_CODE_MAX_RETRIES} attempts. ` +
      `Consider increasing SHORT_CODE_LENGTH.`,
  );
}
