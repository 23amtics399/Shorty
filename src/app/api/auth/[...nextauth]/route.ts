/**
 * Auth.js v5 handler with login rate limiting.
 * Handles GET and POST for all /api/auth/* routes (signin, signout, session, etc.)
 */
import { handlers } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitAuth, getClientIp } from '@/lib/redis/ratelimit';
import { toErrorResponse } from '@/lib/errors';

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Intercept credentials login callback to enforce centralized rate limiting
  if (pathname.includes('/callback/credentials')) {
    const ip = getClientIp(request.headers);
    try {
      await rateLimitAuth(ip);
    } catch (err) {
      const { error, code, status } = toErrorResponse(err);
      return NextResponse.json({ error, code }, { status });
    }
  }

  return handlers.POST(request);
}
