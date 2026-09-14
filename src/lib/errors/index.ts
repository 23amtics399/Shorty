/**
 * Structured error types and helpers for consistent API responses.
 */

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

export function notFound(message = 'Not found'): AppError {
  return new AppError(message, 'NOT_FOUND', 404);
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(message, 'UNAUTHORIZED', 401);
}

export function forbidden(message = 'Access denied'): AppError {
  return new AppError(message, 'FORBIDDEN', 403);
}

export function badRequest(message: string): AppError {
  return new AppError(message, 'BAD_REQUEST', 400);
}

export function conflict(message: string): AppError {
  return new AppError(message, 'CONFLICT', 409);
}

export function tooManyRequests(message = 'Too many requests'): AppError {
  return new AppError(message, 'RATE_LIMITED', 429);
}

export function internalError(message = 'Internal server error'): AppError {
  return new AppError(message, 'INTERNAL_ERROR', 500);
}

export function serviceUnavailable(message = 'Service temporarily unavailable'): AppError {
  return new AppError(message, 'SERVICE_UNAVAILABLE', 503);
}

// ─── Response helper ──────────────────────────────────────────────────────────

export function toErrorResponse(err: unknown): { error: string; code: string; status: number } {
  if (err instanceof AppError) {
    return { error: err.message, code: err.code, status: err.status };
  }
  // Never expose stack traces or internal details in API responses
  return { error: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 };
}
