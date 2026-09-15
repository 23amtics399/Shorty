import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getClientIp,
  rateLimitAnonCreate,
  rateLimitUserCreate,
  rateLimitAuth,
} from '@/lib/redis/ratelimit';
import { redis } from '@/lib/redis/client';

vi.mock('@/lib/redis/client', () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  },
}));

describe('getClientIp', () => {
  it('prioritizes cf-connecting-ip when routed through Cloudflare', () => {
    const headers = new Headers();
    headers.set('cf-connecting-ip', '198.51.100.99');
    headers.set('x-forwarded-for', '172.69.176.13, 198.51.100.99');
    headers.set('x-real-ip', '172.69.176.13');
    expect(getClientIp(headers)).toBe('198.51.100.99');
  });

  it('extracts first IP from comma-separated x-forwarded-for when cf-connecting-ip is missing', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18, 150.172.238.178');
    expect(getClientIp(headers)).toBe('203.0.113.195');
  });

  it('extracts single IP from x-forwarded-for', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '198.51.100.1');
    expect(getClientIp(headers)).toBe('198.51.100.1');
  });

  it('falls back to x-real-ip if x-forwarded-for and cf-connecting-ip are missing', () => {
    const headers = new Headers();
    headers.set('x-real-ip', '198.51.100.2');
    expect(getClientIp(headers)).toBe('198.51.100.2');
  });

  it('returns "unknown" if no IP headers are present', () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe('unknown');
  });
});

describe('rateLimitAnonCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when count is below limit', async () => {
    vi.mocked(redis.incr).mockResolvedValue(1);
    vi.mocked(redis.expire).mockResolvedValue(1);
    vi.mocked(redis.ttl).mockResolvedValue(3600);

    await expect(rateLimitAnonCreate('1.2.3.4')).resolves.toBeUndefined();
    expect(redis.expire).toHaveBeenCalledWith('shorty:rl:anon_create:1.2.3.4', 3600);
  });

  it('throws AppError(429) when Redis limit is exceeded', async () => {
    vi.mocked(redis.incr).mockResolvedValue(6);
    vi.mocked(redis.ttl).mockResolvedValue(1800);

    await expect(rateLimitAnonCreate('1.2.3.4')).rejects.toThrow(/Anonymous link creation limit reached/);
  });

  it('uses conservative in-memory fallback during Redis failure, then fails closed', async () => {
    vi.mocked(redis.incr).mockRejectedValue(new Error('Redis connection failed'));

    // Unique IP for this isolated test
    const testIp = '10.99.88.77';

    // 1st request during outage: allowed under conservative quota
    await expect(rateLimitAnonCreate(testIp)).resolves.toBeUndefined();

    // 2nd request during outage: allowed under conservative quota
    await expect(rateLimitAnonCreate(testIp)).resolves.toBeUndefined();

    // 3rd request during outage: conservative limit (2) exceeded -> fails closed
    await expect(rateLimitAnonCreate(testIp)).rejects.toThrow(/limit reached/);
  });
});

describe('rateLimitAuth (Security Critical)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows auth request when count is below limit', async () => {
    vi.mocked(redis.incr).mockResolvedValue(1);
    vi.mocked(redis.expire).mockResolvedValue(1);
    vi.mocked(redis.ttl).mockResolvedValue(3600);

    await expect(rateLimitAuth('1.2.3.4')).resolves.toBeUndefined();
  });

  it('strictly FAILS CLOSED with 503 when Redis is unavailable', async () => {
    vi.mocked(redis.incr).mockRejectedValue(new Error('Redis connection refused'));

    // Must fail closed with service unavailable — never allow un-rate-limited brute force attacks
    await expect(rateLimitAuth('1.2.3.4')).rejects.toThrow(/temporarily unavailable/);
  });

  it('throws AppError(429) when auth attempts exceed limit', async () => {
    vi.mocked(redis.incr).mockResolvedValue(11);
    vi.mocked(redis.ttl).mockResolvedValue(1800);

    await expect(rateLimitAuth('1.2.3.4')).rejects.toThrow(/Too many authentication attempts/);
  });
});

describe('rateLimitUserCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows user requests within the quota', async () => {
    vi.mocked(redis.incr).mockResolvedValue(10);
    vi.mocked(redis.ttl).mockResolvedValue(3600);

    await expect(rateLimitUserCreate('user-123')).resolves.toBeUndefined();
  });

  it('throws AppError(429) when user limit is exceeded', async () => {
    vi.mocked(redis.incr).mockResolvedValue(51);
    vi.mocked(redis.ttl).mockResolvedValue(1200);

    await expect(rateLimitUserCreate('user-123')).rejects.toThrow(/Link creation limit reached/);
  });
});
