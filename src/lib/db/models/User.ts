/**
 * User Mongoose model.
 * Includes a role field for future role-based access control.
 * V1 admin access is determined by ADMIN_EMAIL env var.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import type { UserRole } from '@/types';

export interface IUser extends Document {
  email: string;
  name: string | null;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    name: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned by default queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection: 'users',
  },
);

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
