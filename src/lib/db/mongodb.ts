/**
 * Mongoose connection singleton.
 * Reuses the connection across hot reloads in development and
 * across serverless invocations in production (via module-level caching).
 */

import mongoose from 'mongoose';
import { logger } from '@/lib/logger';

declare global {
  var _mongooseConn: typeof mongoose | null;
  var _mongooseConnPromise: Promise<typeof mongoose> | null;
}

let cached = global._mongooseConn;
let cachedPromise = global._mongooseConnPromise;

export async function connectToDatabase(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? 'shorty';

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }

  if (cached) {
    return cached;
  }

  if (!cachedPromise) {
    const opts: mongoose.ConnectOptions = {
      dbName: MONGODB_DATABASE,
      bufferCommands: false,
    };

    logger.info('Creating new MongoDB connection');
    cachedPromise = mongoose.connect(MONGODB_URI!, opts).then((m) => {
      logger.info('MongoDB connected');
      return m;
    });

    global._mongooseConnPromise = cachedPromise;
  }

  try {
    cached = await cachedPromise;
    global._mongooseConn = cached;
  } catch (err) {
    cachedPromise = null;
    global._mongooseConnPromise = null;
    throw err;
  }

  return cached;
}
