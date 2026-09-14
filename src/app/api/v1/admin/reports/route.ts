/**
 * GET /api/v1/admin/reports — List abuse reports (Admin only).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Report } from '@/lib/db/models/Report';
import { requireAdmin } from '@/lib/auth/authorization';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (status && ['pending', 'reviewed', 'dismissed', 'actioned'].includes(status)) {
      query.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Report.countDocuments(query),
    ]);

    return NextResponse.json({
      reports,
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
