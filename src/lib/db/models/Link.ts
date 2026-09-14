/**
 * Link Mongoose model.
 *
 * CRITICAL NOTES on TTL index:
 * - expiresAt: Date | null  →  null means the link NEVER expires
 * - TTL index uses expireAfterSeconds: 0 with partialFilterExpression
 *   so that documents where expiresAt=null are NEVER subject to TTL deletion
 * - Request-time expiration check MUST always be performed — TTL is background cleanup only
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import type { OwnerType } from '@/types';

export interface ILink extends Document {
  code: string;
  originalUrl: string;
  createdAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  clickCount: number;
  lastAccessedAt: Date | null;
  ownerId: mongoose.Types.ObjectId | null;
  ownerType: OwnerType;
  customAlias: boolean;
}

const LinkSchema = new Schema<ILink>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 1,
      maxlength: 50,
    },
    originalUrl: {
      type: String,
      required: true,
      maxlength: 2048,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    clickCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ownerType: {
      type: String,
      enum: ['anonymous', 'user'],
      required: true,
    },
    customAlias: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection: 'links',
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Note: code is indexed via `unique: true` in field definition above, providing
// an efficient indexed lookup for all redirect queries.

// Dashboard queries: owner's links sorted by creation (also covers ownerId prefix)
LinkSchema.index({ ownerId: 1, createdAt: -1 });

// TTL index — ONLY applies to documents where expiresAt is a Date (not null)
// Documents with expiresAt: null are permanent and will never be expired by MongoDB
LinkSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $type: 'date' } },
    name: 'link_ttl_date_only',
  },
);

// ─── Model ────────────────────────────────────────────────────────────────────

// Prevent "Cannot overwrite model" errors during hot reload
export const Link: Model<ILink> =
  (mongoose.models.Link as Model<ILink>) || mongoose.model<ILink>('Link', LinkSchema);
