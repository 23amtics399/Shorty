/**
 * Reserved routes — short codes and custom aliases that cannot be used.
 * Keep in sync with proxy.ts matcher exclusions.
 */
export const RESERVED_CODES = new Set([
  // Next.js internals
  '_next',
  'api',
  // App routes
  'login',
  'logout',
  'signup',
  'register',
  'dashboard',
  'settings',
  'account',
  'profile',
  'admin',
  // Public pages
  'about',
  'features',
  'help',
  'support',
  'privacy',
  'terms',
  'developers',
  'docs',
  'report',
  'abuse',
  'pricing',
  'blog',
  // System / infrastructure
  'status',
  'health',
  'ping',
  'robots.txt',
  'sitemap.xml',
  'favicon.ico',
  // Error pages
  'expired',
  'disabled',
  'not-found',
  'error',
  '404',
  '500',
  // Common short words to protect
  'home',
  'new',
  'create',
  'delete',
  'edit',
  'update',
  'search',
  'all',
  'list',
  'me',
]);

export function isReservedCode(code: string): boolean {
  return RESERVED_CODES.has(code.toLowerCase());
}
