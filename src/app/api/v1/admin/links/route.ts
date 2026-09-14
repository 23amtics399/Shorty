/**
 * GET /api/v1/admin/links — List and search all links system-wide (Admin only).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Link } from '@/lib/db/models/Link';
import { requireAdmin } from '@/lib/auth/authorization';
import { enrichLinksWithPendingClicks } from '@/lib/redis/clicks';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const activeFilter = searchParams.get('active');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (activeFilter === 'true') query.isActive = true;
    if (activeFilter === 'false') query.isActive = false;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { code: { $regex: escaped, $options: 'i' } },
        { originalUrl: { $regex: escaped, $options: 'i' } },
        { ownerId: escaped },
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
    const { error, code, status } = toErrorResponse(err);
    return NextResponse.json({ error, code }, { status });
  }
}
