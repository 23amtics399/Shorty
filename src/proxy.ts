/**
 * Next.js 16 Proxy — Redis fast-path redirect.
 *
 * Runs at the network boundary BEFORE route handlers.
 * Runtime: Node.js (Next.js 16 default).
 *
 * Responsibilities:
 *   - Check Redis for a cached short code → redirect 302 if HIT
 *   - Fall through to Route Handler on MISS, Redis outage, expired, or disabled
 *   - Strictly enforce canonical short-code route format (/^[a-zA-Z0-9_-]{1,50}$/)
 *   - Reject path traversal, encoded slashes, multiple leading slashes, and reserved routes
 *     WITHOUT performing unnecessary Redis lookups.
 *
 * Does NOT:
 *   - Access MongoDB
 *   - Silently normalize malformed paths (e.g., ///jk7ien)
 *   - Issue 302 redirects for expired/disabled links (route handler issues 410 Gone)
 */

import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import type { CachedLink } from '@/types';
import { isReservedCode } from '@/lib/config/reserved';

const CANONICAL_SHORTCODE_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;

// ─── Redis lookup (inline, no @upstash/redis client in proxy context) ──────────

async function redisGet(key: string): Promise<CachedLink | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      // 500ms timeout — proxy fast path must stay fast
      signal: AbortSignal.timeout(500),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as { result: string | null };
    if (!json.result) return null;

    return JSON.parse(json.result) as CachedLink;
  } catch {
    // Redis unavailable or timed out — fail open and fall through to route handler
    return null;
  }
}

async function redisIncr(key: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return;

  try {
    await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      // 500ms timeout — proxy fast path must stay fast
      signal: AbortSignal.timeout(500),
    });
  } catch {
    // Non-blocking best-effort click tracking in proxy
  }
}

// ─── Proxy function ───────────────────────────────────────────────────────────

export async function proxy(request: NextRequest, event?: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // 1. Root path is the homepage
  if (pathname === '/' || !pathname) {
    return NextResponse.next();
  }

  // 2. Reject multiple leading/consecutive slashes (e.g. "///code", "//code") — return 404, never normalize
  const rawPathname = request.url.replace(/^https?:\/\/[^/?#]+/, '').split('?')[0].split('#')[0];
  if (pathname.startsWith('//') || rawPathname.startsWith('//') || /\/{2,}/.test(rawPathname)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // 3. Reject traversal attempts and encoded traversal
  const lowerPath = pathname.toLowerCase();
  if (
    lowerPath.includes('..') ||
    lowerPath.includes('%2e') ||
    lowerPath.includes('%2f') ||
    lowerPath.includes('%5c') ||
    lowerPath.includes('\\')
  ) {
    return NextResponse.next();
  }

  // 4. Extract short code candidate — must be strictly top-level path "/{code}"
  if (!pathname.startsWith('/')) {
    return NextResponse.next();
  }

  const code = pathname.slice(1);

  // 5. Must not have nested path segments (e.g. "/code/subpath" or trailing slash "/code/")
  if (code.includes('/')) {
    return NextResponse.next();
  }

  // 6. Must strictly match canonical character set and length (1-50 chars)
  if (!CANONICAL_SHORTCODE_REGEX.test(code)) {
    return NextResponse.next();
  }

  // 7. Must not be a reserved application code
  if (isReservedCode(code)) {
    return NextResponse.next();
  }

  // ─── Redis Fast-Path Lookup ─────────────────────────────────────────────────
  const cacheKey = `shorty:link:${code}`;
  const cached = await redisGet(cacheKey);

  if (!cached) {
    // Cache MISS or Redis unavailable — fall through to app/[shortCode]/route.ts
    return NextResponse.next();
  }

  // If cached state indicates disabled, fall through to route handler for authoritative 410 Gone
  if (!cached.isActive) {
    return NextResponse.next();
  }

  // If cached state indicates expired, fall through to route handler for authoritative 410 Gone
  if (cached.expiresAt !== null && cached.expiresAt <= Date.now()) {
    return NextResponse.next();
  }

  // Schedule Redis click counter increment in the request lifecycle without delaying redirect
  const clickKey = `shorty:clicks:${code}`;
  const incrPromise = redisIncr(clickKey);
  if (event && typeof event.waitUntil === 'function') {
    event.waitUntil(incrPromise);
  } else {
    void incrPromise;
  }

  // Cache HIT — instantaneous HTTP 302 redirect (never blocked by click write)
  return NextResponse.redirect(cached.url, 302);
}

// ─── Matcher Config ───────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match only potential short codes.
     * Excludes Next.js internals, static assets, API endpoints, and known pages.
     */
    '/((?!api|_next/static|_next/image|_next/data|favicon\\.ico|sitemap\\.xml|robots\\.txt|about|features|help|privacy|terms|developers|report|dashboard|admin|login|logout|signup|register|settings|account|profile|expired|disabled|not-found|pricing|status|health|error).*)',
  ],
};
