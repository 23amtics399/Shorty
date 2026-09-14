/**
 * PUT /api/v1/admin/reports/[id] — Update abuse report status (Admin only).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Report } from '@/lib/db/models/Report';
import { requireAdmin } from '@/lib/auth/authorization';
import { toErrorResponse, notFound, badRequest } from '@/lib/errors';
import type { ReportStatus } from '@/types';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) throw notFound();

    let body: { status?: ReportStatus };
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }

    const { status } = body;
    const allowedStatuses: ReportStatus[] = ['pending', 'reviewed', 'dismissed', 'actioned'];

    if (!status || !allowedStatuses.includes(status)) {
      throw badRequest(`status must be one of: ${allowedStatuses.join(', ')}`);
    }

    await connectToDatabase();

    const report = await Report.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          reviewedAt: new Date(),
        },
      },
      { new: true },
    ).lean();

    if (!report) throw notFound();

    return NextResponse.json(report);
  } catch (err) {
    const { error, code, status } = toErrorResponse(err);
    return NextResponse.json({ error, code }, { status });
  }
}
