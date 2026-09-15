/**
 * POST /api/v1/links — Create a new short link.
 *
 * Anonymous users: max 24h lifetime, rate limited by IP (5/hr)
 * Authenticated users: max 30d lifetime, rate limited by userId (50/hr)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Link } from '@/lib/db/models/Link';
import { validateUrl } from '@/lib/url/validate';
import { validateAlias } from '@/lib/shortcode/validate';
import { generateUniqueCode } from '@/lib/shortcode/generate';
import { rateLimitAnonCreate, rateLimitUserCreate, getClientIp } from '@/lib/redis/ratelimit';
import { enrichLinksWithPendingClicks } from '@/lib/redis/clicks';
import { toErrorResponse, badRequest, conflict, unauthorized } from '@/lib/errors';
import { APP_URL, ANONYMOUS_MAX_LINK_LIFETIME_HOURS, AUTHENTICATED_MAX_LINK_LIFETIME_DAYS } from '@/lib/config';
import type { CreateLinkRequest, CreateLinkResponse } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const ip = getClientIp(request.headers);

    // ── Rate limiting ──────────────────────────────────────────────────────
    if (session?.user?.id) {
      await rateLimitUserCreate(session.user.id);
    } else {
      await rateLimitAnonCreate(ip);
    }

    // ── Parse and validate request body ───────────────────────────────────
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 65536) {
      throw badRequest('Payload too large (max 64KB)');
    }

    let body: CreateLinkRequest;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }

    if (!body || typeof body !== 'object') {
      throw badRequest('Invalid JSON body');
    }

    const { url, customAlias, expiresAt: expiresAtRaw } = body;

    // URL validation
    const urlResult = validateUrl(url);
    if (!urlResult.valid) {
      throw badRequest(urlResult.error ?? 'Invalid URL');
    }
    const normalizedUrl = urlResult.normalizedUrl!;

    // Expiration validation and lifetime enforcement
    let expiresAt: Date | null = null;

    if (expiresAtRaw) {
      const requestedExpiry = new Date(expiresAtRaw);
      if (isNaN(requestedExpiry.getTime())) {
        throw badRequest('Invalid expiresAt date');
      }
      if (requestedExpiry <= new Date()) {
        throw badRequest('expiresAt must be in the future');
      }

      if (session?.user?.id) {
        // Authenticated: cap at AUTHENTICATED_MAX_LINK_LIFETIME_DAYS
        const maxExpiry = new Date();
        maxExpiry.setDate(maxExpiry.getDate() + AUTHENTICATED_MAX_LINK_LIFETIME_DAYS);
        expiresAt = requestedExpiry > maxExpiry ? maxExpiry : requestedExpiry;
      } else {
        // Anonymous: cap at ANONYMOUS_MAX_LINK_LIFETIME_HOURS
        const maxExpiry = new Date();
        maxExpiry.setHours(maxExpiry.getHours() + ANONYMOUS_MAX_LINK_LIFETIME_HOURS);
        expiresAt = requestedExpiry > maxExpiry ? maxExpiry : requestedExpiry;
      }
    } else {
      // No expiry specified
      if (session?.user?.id) {
        // Authenticated: no expiry (permanent)
        expiresAt = null;
      } else {
        // Anonymous: enforce max lifetime
        const maxExpiry = new Date();
        maxExpiry.setHours(maxExpiry.getHours() + ANONYMOUS_MAX_LINK_LIFETIME_HOURS);
        expiresAt = maxExpiry;
      }
    }

    // Custom alias validation
    let code: string;
    let isCustomAlias = false;

    if (customAlias) {
      if (!session?.user?.id) {
        throw badRequest('Custom aliases require an account');
      }
      const aliasResult = validateAlias(customAlias);
      if (!aliasResult.valid) {
        throw badRequest(aliasResult.error ?? 'Invalid alias');
      }
      code = customAlias.trim();
      isCustomAlias = true;
    } else {
      // Generate unique code
      await connectToDatabase();
      code = await generateUniqueCode(async (c) => {
        const existing = await Link.exists({ code: c });
        return !!existing;
      });
    }

    // ── Database write ─────────────────────────────────────────────────────
    await connectToDatabase();

    try {
      const link = await Link.create({
        code,
        originalUrl: normalizedUrl,
        expiresAt,
        isActive: true,
        clickCount: 0,
        lastAccessedAt: null,
        ownerId: session?.user?.id ?? null,
        ownerType: session?.user?.id ? 'user' : 'anonymous',
        customAlias: isCustomAlias,
      });

      const response: CreateLinkResponse = {
        id: link._id ? link._id.toString() : undefined,
        code: link.code,
        shortUrl: `${APP_URL}/${link.code}`,
        originalUrl: link.originalUrl,
        expiresAt: link.expiresAt?.toISOString() ?? null,
      };

      return NextResponse.json(response, { status: 201 });
    } catch (err: unknown) {
      // MongoDB duplicate key error
      if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
        throw conflict('That alias is already taken');
      }
      throw err;
    }
  } catch (err) {
    const { error, code: errCode, status } = toErrorResponse(err);
    return NextResponse.json({ error, code: errCode }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorized('Sign in required to view your links');
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const query: Record<string, unknown> = {
      ownerId: session.user.id,
    };

    if (search) {
      // Escape regex special chars to prevent invalid regex
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { code: { $regex: escaped, $options: 'i' } },
        { originalUrl: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [rawLinks, total] = await Promise.all([
      Link.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Link.countDocuments(query),
    ]);

    const links = await enrichLinksWithPendingClicks(rawLinks);

    return NextResponse.json({
      links,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    const { error, code: errCode, status } = toErrorResponse(err);
    return NextResponse.json({ error, code: errCode }, { status });
  }
}

