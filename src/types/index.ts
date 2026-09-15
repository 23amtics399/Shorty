/**
 * Shared TypeScript types for Shorty.
 */

// ─── Link ──────────────────────────────────────────────────────────────────────

export type OwnerType = 'anonymous' | 'user';

/** The link document shape as returned from MongoDB (plain object, not Mongoose doc) */
export interface LinkDocument {
  _id: string;
  code: string;
  originalUrl: string;
  createdAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  clickCount: number;
  persistedClicks?: number;
  pendingClicks?: number;
  lastAccessedAt: Date | null;
  ownerId: string | null;
  ownerType: OwnerType;
  customAlias: boolean;
}

/** Cached link shape stored in Redis */
export interface CachedLink {
  url: string;
  expiresAt: number | null; // Unix timestamp ms, or null if no expiry
  isActive: boolean;
}

// ─── User ──────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin';

export interface UserDocument {
  _id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

// ─── Report ────────────────────────────────────────────────────────────────────

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';
export type ReportReason =
  | 'phishing'
  | 'malware'
  | 'spam'
  | 'illegal'
  | 'harassment'
  | 'other';

export interface ReportDocument {
  _id: string;
  linkCode: string;
  originalUrl: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: Date;
  reviewedAt: Date | null;
}

// ─── API request/response shapes ──────────────────────────────────────────────

export interface CreateLinkRequest {
  url: string;
  customAlias?: string;
  expiresAt?: string | null; // ISO date string
}

export interface CreateLinkResponse {
  code: string;
  shortUrl: string;
  originalUrl: string;
  expiresAt: string | null;
}

export interface UpdateLinkRequest {
  url?: string;
  isActive?: boolean;
  expiresAt?: string | null;
}

export interface SubmitReportRequest {
  linkCode: string;
  reason: ReportReason;
  details?: string;
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string;
  code: string;
  status: number;
}

// ─── Session (Auth.js extension) ─────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
    };
  }
  interface User {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  }
}
