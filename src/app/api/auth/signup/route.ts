/**
 * POST /api/auth/signup — Register a new user account.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/lib/db/models/User';
import { ADMIN_EMAIL } from '@/lib/config';
import { rateLimitAuth, getClientIp } from '@/lib/redis/ratelimit';
import { toErrorResponse, badRequest, conflict } from '@/lib/errors';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    await rateLimitAuth(ip);

    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 65536) {
      throw badRequest('Payload too large (max 64KB)');
    }

    let body: { email?: string; password?: string; name?: string };
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }

    const { email: rawEmail, password, name } = body;

    if (!rawEmail || typeof rawEmail !== 'string') {
      throw badRequest('Valid email is required');
    }

    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw badRequest('Invalid email address format');
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      throw badRequest('Password must be at least 8 characters long');
    }

    await connectToDatabase();

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      throw conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const configuredAdmin = (process.env.ADMIN_EMAIL || ADMIN_EMAIL || '').trim().toLowerCase();
    const role = configuredAdmin && email === configuredAdmin ? 'admin' : 'user';

    const user = await User.create({
      email,
      name: name?.trim() || null,
      passwordHash,
      role,
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const { error, code, status } = toErrorResponse(err);
    return NextResponse.json({ error, code }, { status });
  }
}
