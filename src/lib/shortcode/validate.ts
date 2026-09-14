/**
 * Short code and custom alias validation rules.
 */

import { ALIAS_MIN_LENGTH, ALIAS_MAX_LENGTH } from '@/lib/config';
import { isReservedCode } from '@/lib/config/reserved';

/** Only alphanumeric + hyphen + underscore */
const ALIAS_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a custom alias provided by the user.
 */
export function validateAlias(alias: string): ValidationResult {
  const trimmed = alias.trim();

  if (!trimmed) {
    return { valid: false, error: 'Alias cannot be empty' };
  }

  if (trimmed.length < ALIAS_MIN_LENGTH) {
    return {
      valid: false,
      error: `Alias must be at least ${ALIAS_MIN_LENGTH} characters`,
    };
  }

  if (trimmed.length > ALIAS_MAX_LENGTH) {
    return {
      valid: false,
      error: `Alias must be at most ${ALIAS_MAX_LENGTH} characters`,
    };
  }

  if (!ALIAS_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Alias may only contain letters, numbers, hyphens, and underscores',
    };
  }

  if (isReservedCode(trimmed)) {
    return { valid: false, error: 'That alias is reserved and cannot be used' };
  }

  return { valid: true };
}

/**
 * Validate a generated or provided short code (internal use).
 * Short codes are stricter than aliases — alphanumeric only.
 */
export function validateShortCode(code: string): ValidationResult {
  if (!code || code.length === 0) {
    return { valid: false, error: 'Short code cannot be empty' };
  }

  if (!/^[a-zA-Z0-9]+$/.test(code)) {
    return { valid: false, error: 'Short code must be alphanumeric' };
  }

  if (isReservedCode(code)) {
    return { valid: false, error: 'Short code is reserved' };
  }

  return { valid: true };
}
