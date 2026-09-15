import { describe, it, expect } from 'vitest';
import { validateUrl } from '@/lib/url/validate';

describe('validateUrl', () => {
  // ── Valid URLs ──────────────────────────────────────────────────────────────
  it('accepts valid http URL', () => {
    const result = validateUrl('http://example.com');
    expect(result.valid).toBe(true);
    expect(result.normalizedUrl).toBeDefined();
  });

  it('accepts valid https URL', () => {
    const result = validateUrl('https://example.com/path?q=1#anchor');
    expect(result.valid).toBe(true);
  });

  it('accepts URL with port', () => {
    expect(validateUrl('https://example.com:8080/path').valid).toBe(true);
  });

  it('normalizes URL', () => {
    const result = validateUrl('HTTPS://Example.Com/PATH');
    expect(result.valid).toBe(true);
  });

  // ── Invalid / empty / non-string boundaries ───────────────────────────────
  it('rejects undefined url', () => {
    const res = validateUrl(undefined);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('URL is required');
  });

  it('rejects null url', () => {
    const res = validateUrl(null);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('URL is required');
  });

  it('rejects number url', () => {
    const res = validateUrl(12345 as unknown as string);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('URL is required');
  });

  it('rejects object url', () => {
    const res = validateUrl({ foo: 'bar' } as unknown as string);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('URL is required');
  });

  it('rejects empty string', () => {
    const res = validateUrl('');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('URL is required');
  });

  it('rejects whitespace-only string', () => {
    const res = validateUrl('   \t  \n ');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('URL is required');
  });

  it('rejects non-URL string', () => {
    expect(validateUrl('not a url').valid).toBe(false);
  });

  it('rejects URL too long', () => {
    expect(validateUrl('https://example.com/' + 'a'.repeat(2050)).valid).toBe(false);
  });

  // ── Protocol blocking ───────────────────────────────────────────────────────
  it('rejects javascript: protocol', () => {
    expect(validateUrl('javascript:alert(1)').valid).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(validateUrl('data:text/html,<h1>hi</h1>').valid).toBe(false);
  });

  it('rejects ftp: protocol', () => {
    expect(validateUrl('ftp://files.example.com').valid).toBe(false);
  });

  it('rejects file: protocol', () => {
    expect(validateUrl('file:///etc/passwd').valid).toBe(false);
  });

  // ── Localhost / loopback ────────────────────────────────────────────────────
  it('rejects localhost', () => {
    expect(validateUrl('http://localhost/secret').valid).toBe(false);
  });

  it('rejects 127.0.0.1', () => {
    expect(validateUrl('http://127.0.0.1:3000').valid).toBe(false);
  });

  it('rejects 127.x.x.x range', () => {
    expect(validateUrl('http://127.0.0.2').valid).toBe(false);
  });

  it('rejects 0.0.0.0', () => {
    expect(validateUrl('http://0.0.0.0').valid).toBe(false);
  });

  // ── Private network ranges ──────────────────────────────────────────────────
  it('rejects 10.x.x.x private range', () => {
    expect(validateUrl('http://10.0.0.1').valid).toBe(false);
  });

  it('rejects 192.168.x.x private range', () => {
    expect(validateUrl('http://192.168.1.1').valid).toBe(false);
  });

  it('rejects 172.16-31.x.x private range', () => {
    expect(validateUrl('http://172.16.0.1').valid).toBe(false);
    expect(validateUrl('http://172.31.255.255').valid).toBe(false);
  });

  it('allows 172.32.x.x (not private)', () => {
    expect(validateUrl('http://172.32.0.1').valid).toBe(true);
  });

  // ── Internal hostnames ──────────────────────────────────────────────────────
  it('rejects hostname with no TLD', () => {
    expect(validateUrl('http://myserver').valid).toBe(false);
  });

  it('rejects .local TLD', () => {
    expect(validateUrl('http://server.local').valid).toBe(false);
  });

  it('rejects .internal TLD', () => {
    expect(validateUrl('http://app.internal').valid).toBe(false);
  });

  // ── Cloud Metadata, IPv6 & Edge Cases ───────────────────────────────────────
  it('rejects AWS/GCP cloud link-local metadata address (169.254.169.254)', () => {
    expect(validateUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false);
  });

  it('rejects Carrier-Grade NAT (100.64.0.0/10)', () => {
    expect(validateUrl('http://100.64.0.1/admin').valid).toBe(false);
  });

  it('rejects IPv6 loopback [::1]', () => {
    expect(validateUrl('http://[::1]/secret').valid).toBe(false);
  });

  it('rejects IPv6 unique-local address [fd00::1]', () => {
    expect(validateUrl('http://[fd00::1]/service').valid).toBe(false);
  });

  it('rejects IPv4-mapped IPv6 address [::ffff:127.0.0.1]', () => {
    expect(validateUrl('http://[::ffff:127.0.0.1]').valid).toBe(false);
  });

  it('rejects invalid out-of-range ports', () => {
    expect(validateUrl('http://example.com:99999').valid).toBe(false);
  });

  it('accepts valid URL with userinfo and preserves path', () => {
    const res = validateUrl('https://user:pass@example.com/api/data');
    expect(res.valid).toBe(true);
    expect(res.normalizedUrl).toContain('example.com/api/data');
  });
});
