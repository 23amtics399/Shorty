/**
 * Short code redirect — MongoDB fallback Route Handler.
 *
 * This is a Next.js Route Handler (exports GET function).
 * It is NOT a page component — React is never loaded for redirect requests.
 *
 * HTTP Semantics:
 *   - Active valid link  → HTTP 302 redirect to originalUrl
 *   - Nonexistent link   → HTTP 404 Not Found (polished status body)
 *   - Expired link       → HTTP 410 Gone (polished status body)
 *   - Disabled link      → HTTP 410 Gone (polished status body)
 *
 * Responsibilities:
 *   1. MongoDB lookup (authoritative source of truth)
 *   2. Request-time expiration + isActive validation
 *   3. Populate Redis cache on success
 *   4. Atomic, non-blocking click count increment ($inc operator)
 *   5. Accurate HTTP status responses without deceptive 302 loops
 */

import { NextResponse, after } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Link } from '@/lib/db/models/Link';
import { setCachedLink } from '@/lib/redis/cache';
import { getAndResetPendingClicks, restorePendingClicks } from '@/lib/redis/clicks';
import { logger } from '@/lib/logger';
import type { CachedLink } from '@/types';

export const runtime = 'nodejs';

function renderStatusResponse(
  request: NextRequest,
  status: 404 | 410,
  title: string,
  message: string,
  icon: string,
  errCode: string,
): NextResponse {
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('application/json')) {
    return NextResponse.json(
      { error: message, code: errCode },
      {
        status,
        headers: { 'cache-control': 'no-store, max-age=0' },
      },
    );
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} | Shorty</title>
  <style>
    :root {
      --bg: #0d0e14;
      --card-bg: rgba(22, 26, 38, 0.7);
      --border: rgba(45, 52, 75, 0.4);
      --text: #f0f3fa;
      --text-muted: #959fad;
      --primary: #8b5cf6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem 2rem;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; display: block; }
    .status-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.5rem;
      background: rgba(139, 92, 246, 0.12);
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      border: 1px solid rgba(139, 92, 246, 0.25);
    }
    h1 { font-size: 1.625rem; margin-bottom: 0.75rem; font-weight: 700; }
    p { color: var(--text-muted); line-height: 1.6; margin-bottom: 1.75rem; font-size: 0.9375rem; }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #8b5cf6 0%, #38bdf8 100%);
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.9375rem;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">${icon}</span>
    <span class="status-badge">HTTP ${status}</span>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Create a Short Link</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode: code } = await params;

  if (!code || code.includes('/') || !/^[a-zA-Z0-9_-]{1,50}$/.test(code)) {
    return renderStatusResponse(
      request,
      404,
      'Link Not Found',
      'The requested short link does not exist or has been removed.',
      '🔍',
      'NOT_FOUND',
    );
  }

  try {
    await connectToDatabase();

    const link = await Link.findOne({ code }).lean();

    // ── 1. Nonexistent link → HTTP 404 ──────────────────────────────────────────
    if (!link) {
      return renderStatusResponse(
        request,
        404,
        'Link Not Found',
        'Link not found. We couldn’t find any destination configured for this short code.',
        '🔍',
        'NOT_FOUND',
      );
    }

    // ── 2. Disabled link → HTTP 410 ────────────────────────────────────────────
    if (!link.isActive) {
      // Cache the disabled state so proxy fast path handles future requests without DB
      const cachedDisabled: CachedLink = {
        url: link.originalUrl,
        expiresAt: link.expiresAt ? link.expiresAt.getTime() : null,
        isActive: false,
      };
      await setCachedLink(code, cachedDisabled);

      return renderStatusResponse(
        request,
        410,
        'Link Disabled',
        'This short link has been disabled by its owner or temporarily suspended.',
        '🚫',
        'GONE',
      );
    }

    // ── 3. Expired link → HTTP 410 (request-time check) ────────────────────────
    if (link.expiresAt !== null && link.expiresAt <= new Date()) {
      // Mark as inactive in MongoDB in background
      Link.updateOne({ _id: link._id }, { $set: { isActive: false } }).catch(() => {});

      return renderStatusResponse(
        request,
        410,
        'Link Expired',
        'This short link has reached its expiration date and is no longer active.',
        '⏱️',
        'GONE',
      );
    }

    // ── 4. Valid link — populate cache, then HTTP 302 redirect ─────────────────
    const cachedLink: CachedLink = {
      url: link.originalUrl,
      expiresAt: link.expiresAt ? link.expiresAt.getTime() : null,
      isActive: true,
    };
    await setCachedLink(code, cachedLink);

    // Atomic analytics update ($inc operator) — 1 for this miss + any unflushed Redis clicks
    const pendingClicks = await getAndResetPendingClicks(code);
    const totalIncrement = 1 + pendingClicks;

    const persistenceTask = Link.updateOne(
      { _id: link._id },
      {
        $inc: { clickCount: totalIncrement },
        $set: { lastAccessedAt: new Date() },
      },
    )
      .then((res) => {
        if (res && res.matchedCount === 0) {
          throw new Error(`Link _id "${link._id}" not found in MongoDB`);
        }
      })
      .catch(async (err: unknown) => {
        logger.warn('Failed to update click count in MongoDB on cache miss', {
          code,
          error: err instanceof Error ? err.message : 'unknown',
        });

        // Failure-Safe Persistence:
        // If we claimed pending clicks from Redis and MongoDB failed,
        // restore claimed pending clicks back to Redis via atomic INCRBY
        if (pendingClicks > 0) {
          try {
            await restorePendingClicks(code, pendingClicks);
            logger.warn('Restored unflushed Redis clicks after MongoDB cache-miss update failure', {
              code,
              restoredClicks: pendingClicks,
            });
          } catch (restoreErr) {
            logger.error('CRITICAL: Failed to restore pending clicks to Redis after MongoDB failure on cache miss', {
              code,
              unpersistedClicks: pendingClicks,
              mongoError: err instanceof Error ? err.message : 'unknown',
              restoreError: restoreErr instanceof Error ? restoreErr.message : 'unknown',
            });
          }
        }
      });

    try {
      after(persistenceTask);
    } catch {
      void persistenceTask;
    }

    return NextResponse.redirect(link.originalUrl, 302);
  } catch (err) {
    logger.error('Redirect handler error', {
      code,
      error: err instanceof Error ? err.message : 'unknown',
    });

    return renderStatusResponse(
      request,
      404,
      'Link Unavailable',
      'The requested link could not be resolved at this time.',
      '⚠️',
      'NOT_FOUND',
    );
  }
}
