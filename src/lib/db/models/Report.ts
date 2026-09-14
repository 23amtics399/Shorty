/**
 * Abuse Report Mongoose model.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import type { ReportReason, ReportStatus } from '@/types';

export interface IReport extends Document {
  linkCode: string;
  originalUrl: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: Date;
  reviewedAt: Date | null;
}

const ReportSchema = new Schema<IReport>(
  {
    linkCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    originalUrl: {
      type: String,
      required: true,
      maxlength: 2048,
    },
    reason: {
      type: String,
      enum: ['phishing', 'malware', 'spam', 'illegal', 'harassment', 'other'],
      required: true,
    },
    details: {
      type: String,
      default: null,
      maxlength: 1000,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'dismissed', 'actioned'],
      default: 'pending',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection: 'reports',
  },
);

// Admin review queue: pending reports first, newest first
ReportSchema.index({ status: 1, createdAt: -1 });

export const Report: Model<IReport> =
  (mongoose.models.Report as Model<IReport>) || mongoose.model<IReport>('Report', ReportSchema);
