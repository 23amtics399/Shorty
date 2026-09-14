import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Use proxy.ts convention (Next.js 16)
  // No explicit runtime config needed — proxy.ts defaults to Node.js

  // Disable x-powered-by header in responses
  poweredByHeader: false,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // Experimental: Server Actions are stable in Next.js 16
  experimental: {},
};

export default nextConfig;
