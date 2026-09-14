/**
 * Upstash Redis client singleton.
 * Uses @upstash/redis HTTP REST client — works in Node.js serverless on Vercel.
 */

import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://placeholder.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'placeholder_token',
});
