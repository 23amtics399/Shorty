/**
 * Server-side authorization helpers.
 *
 * Rules:
 * - Never trust client-provided role/email/userId
 * - All checks are server-side using Auth.js auth()
 * - V1: admin is determined by ADMIN_EMAIL env var match
 * - Future: check user.role === 'admin' from DB (role field already exists)
 */

import { auth } from './config';
import { ADMIN_EMAIL } from '@/lib/config';
import { unauthorized, forbidden } from '@/lib/errors';

/**
 * Require an authenticated session.
 * Returns the session. Throws AppError(401) if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.email) {
    throw unauthorized();
  }
  return session;
}

/**
 * Require the currently signed-in user to be the admin.
 * V1: checks against ADMIN_EMAIL environment variable.
 * Returns the session. Throws AppError(401/403) if not authorized.
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.email) {
    throw unauthorized();
  }

  const adminEmail = (process.env.ADMIN_EMAIL || ADMIN_EMAIL || '').trim().toLowerCase();
  const userEmail = session.user.email.trim().toLowerCase();
  const userRole = (session.user as { role?: string })?.role;

  const isMatch = (adminEmail && userEmail === adminEmail) || userRole === 'admin';

  if (!isMatch) {
    if (!adminEmail && userRole !== 'admin') {
      throw forbidden('Admin access is not configured on this server');
    }
    throw forbidden();
  }

  return session;
}

/**
 * Check if the current session is the admin (non-throwing version).
 */
export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

/**
 * Require the current user to be the owner of a resource, or an admin.
 * Throws AppError(403) if neither condition is met.
 */
export async function requireOwnerOrAdmin(ownerId: string | null) {
  const session = await auth();

  if (!session?.user?.email) {
    throw unauthorized();
  }

  const isOwner = ownerId !== null && session.user.id === ownerId;
  const adminEmail = (process.env.ADMIN_EMAIL || ADMIN_EMAIL || '').trim().toLowerCase();
  const userEmail = session.user.email.trim().toLowerCase();
  const userRole = (session.user as { role?: string })?.role;
  const adminMatch = (adminEmail && userEmail === adminEmail) || userRole === 'admin';

  if (!isOwner && !adminMatch) {
    throw forbidden();
  }

  return session;
}
