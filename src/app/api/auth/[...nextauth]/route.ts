/**
 * Auth.js v5 handler.
 * Handles GET and POST for all /api/auth/* routes (signin, signout, session, etc.)
 */
import { handlers } from '@/lib/auth/config';

export const { GET, POST } = handlers;
