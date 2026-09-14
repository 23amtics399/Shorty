/**
 * GET/PUT/DELETE /api/v1/links/[id]
 * Owner-only operations on a specific link (by MongoDB _id).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Link } from '@/lib/db/models/Link';
import { requireOwnerOrAdmin } from '@/lib/auth/authorization';
import { invalidateCachedLink } from '@/lib/redis/cache';
import { getPendingClicks, flushPendingClicks, getAndResetPendingClicks } from '@/lib/redis/clicks';
import { toErrorResponse, notFound, badRequest } from '@/lib/errors';
import { AUTHENTICATED_MAX_LINK_LIFETIME_DAYS } from '@/lib/config';
import type { UpdateLinkRequest } from '@/types';

export const runtime = 'nodejs';

// ── GET /api/v1/links/[id] ────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    if (!mongoose.isValidObjectId(id)) throw notFound();
    const link = await Link.findById(id).lean();
    if (!link) throw notFound();

    await requireOwnerOrAdmin(link.ownerId?.toString() ?? null);

    const pending = await getPendingClicks(link.code);
    if (pending > 0) {
      flushPendingClicks(link.code).catch(() => {});
      link.clickCount += pending;
    }

    return NextResponse.json(link);
  } catch (err) {
    const { error, code, status } = toErrorResponse(err);
    return NextResponse.json({ error, code }, { status });
  }
}

// ── PUT /api/v1/links/[id] ────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    if (!mongoose.isValidObjectId(id)) throw notFound();
    const link = await Link.findById(id).lean();
    if (!link) throw notFound();

    const session = await requireOwnerOrAdmin(link.ownerId?.toString() ?? null);

    let body: UpdateLinkRequest;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.isActive === 'boolean') {
      updates.isActive = body.isActive;
    }

    if ('expiresAt' in body) {
      if (body.expiresAt === null) {
        updates.expiresAt = null;
      } else if (body.expiresAt) {
        const newExpiry = new Date(body.expiresAt);
        if (isNaN(newExpiry.getTime())) throw badRequest('Invalid expiresAt date');
        if (newExpiry <= new Date()) throw badRequest('expiresAt must be in the future');

        // Enforce max lifetime for non-admin users
        const isAdminUser =
          process.env.ADMIN_EMAIL &&
          session.user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

        if (!isAdminUser) {
          const maxExpiry = new Date(link.createdAt);
          maxExpiry.setDate(maxExpiry.getDate() + AUTHENTICATED_MAX_LINK_LIFETIME_DAYS);
          updates.expiresAt = newExpiry > maxExpiry ? maxExpiry : newExpiry;
        } else {
          updates.expiresAt = newExpiry;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      throw badRequest('No valid fields to update');
    }

    const updated = await Link.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();

    // Invalidate Redis cache
    await invalidateCachedLink(link.code);

    return NextResponse.json(updated);
  } catch (err) {
    const { error, code, status } = toErrorResponse(err);
    return NextResponse.json({ error, code }, { status });
  }
}

// ── DELETE /api/v1/links/[id] ─────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    if (!mongoose.isValidObjectId(id)) throw notFound();
    const link = await Link.findById(id).lean();
    if (!link) throw notFound();

    await requireOwnerOrAdmin(link.ownerId?.toString() ?? null);

    await Link.findByIdAndDelete(id);

    // Invalidate Redis cache and clean up click counters
    await Promise.all([
      invalidateCachedLink(link.code),
      getAndResetPendingClicks(link.code),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const { error, code, status } = toErrorResponse(err);
    return NextResponse.json({ error, code }, { status });
  }
}
