/**
 * URL validation for submitted destination URLs.
 *
 * Rules:
 * - Must parse as a valid URL
 * - Protocol must be http: or https:
 * - Blocks dangerous schemes
 * - Blocks loopback / private network addresses
 * - Blocks internal-only hostnames (no TLD, .local, .internal, .corp)
 * - NO server-side fetching — validation is purely structural
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

const BLOCKED_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'file:',
  'ftp:',
  'blob:',
  'vbscript:',
  'mailto:',
  'tel:',
]);

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1', '[::1]']);

const BLOCKED_TLD_SUFFIXES = ['.local', '.internal', '.corp', '.lan', '.home', '.intranet'];

/** True if the hostname is a private/loopback IP */
function isPrivateIp(hostname: string): boolean {
  // Remove IPv6 brackets
  const host = hostname.replace(/^\[|\]$/g, '');

  // IPv4 loopback
  if (/^127\./.test(host)) return true;

  // Cloud metadata link-local address (169.254.0.0/16)
  if (/^169\.254\./.test(host)) return true;

  // Carrier-Grade NAT (100.64.0.0/10)
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(host)) return true;

  // IPv4 private ranges
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  // 172.16.0.0 – 172.31.255.255
  const match = host.match(/^172\.(\d+)\./);
  if (match && parseInt(match[1], 10) >= 16 && parseInt(match[1], 10) <= 31) return true;

  // IPv6 loopback, link-local, unique local, and IPv4-mapped IPv6
  if (
    host === '::1' ||
    host === '::' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('::ffff:')
  ) {
    return true;
  }

  return false;
}

/** True if hostname has no public TLD (e.g. "myserver", "host.local") */
function isInternalHostname(hostname: string): boolean {
  // No dots = no TLD
  if (!hostname.includes('.')) return true;

  // Blocked TLD suffixes
  for (const suffix of BLOCKED_TLD_SUFFIXES) {
    if (hostname.endsWith(suffix)) return true;
  }

  return false;
}

export function validateUrl(rawUrl: unknown): UrlValidationResult {
  if (rawUrl === undefined || rawUrl === null || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return { valid: false, error: 'URL is required' };
  }

  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL is too long (max 2048 characters)' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL — please include http:// or https://' };
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
      return { valid: false, error: `Protocol "${parsed.protocol}" is not allowed` };
    }
    return { valid: false, error: 'Only http:// and https:// URLs are supported' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Blocked exact hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: 'That URL points to a blocked address' };
  }

  // Private IP ranges
  if (isPrivateIp(hostname)) {
    return { valid: false, error: 'That URL points to a private network address' };
  }

  // Internal hostnames
  if (isInternalHostname(hostname)) {
    return { valid: false, error: 'That URL does not appear to be a public address' };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
  };
}
