/**
 * POST /api/v1/report — Submit an abuse report for a short link.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Link } from '@/lib/db/models/Link';
import { Report } from '@/lib/db/models/Report';
import { rateLimitApi, getClientIp } from '@/lib/redis/ratelimit';
import { toErrorResponse, badRequest, notFound } from '@/lib/errors';
import type { SubmitReportRequest, ReportReason } from '@/types';

export const runtime = 'nodejs';

const VALID_REASONS: ReportReason[] = [
  'phishing',
  'malware',
  'spam',
  'illegal',
  'harassment',
  'other',
];

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    await rateLimitApi(ip);

    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 65536) {
      throw badRequest('Payload too large (max 64KB)');
    }

    let body: SubmitReportRequest;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }

    const { linkCode, reason, details } = body;

    if (!linkCode || typeof linkCode !== 'string') {
      throw badRequest('linkCode is required');
    }

    if (!reason || !VALID_REASONS.includes(reason)) {
      throw badRequest(`reason must be one of: ${VALID_REASONS.join(', ')}`);
    }

    if (details && typeof details === 'string' && details.length > 1000) {
      throw badRequest('details must be 1000 characters or less');
    }

    await connectToDatabase();

    // Verify the link exists
    const link = await Link.findOne({ code: linkCode.trim() }).lean();
    if (!link) throw notFound('Link not found');

    await Report.create({
      linkCode: linkCode.trim(),
      originalUrl: link.originalUrl,
      reason,
      details: details?.trim() ?? null,
      status: 'pending',
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const { error, code, status } = toErrorResponse(err);
    return NextResponse.json({ error, code }, { status });
  }
}
