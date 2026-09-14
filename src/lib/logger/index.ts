/**
 * Structured server-side logger.
 * Redacts sensitive fields. Never logs raw secrets, passwords, or tokens.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'auth',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = redact(val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const isDev = process.env.NODE_ENV === 'development';
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? redact(context) : {}),
  };

  if (isDev) {
    // Pretty print in development
    const prefix = { debug: '🔍', info: 'ℹ️ ', warn: '⚠️ ', error: '❌' }[level];
    console[level === 'debug' ? 'log' : level](`${prefix} [Shorty] ${message}`, context ?? '');
  } else {
    // Structured JSON in production
    console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};
