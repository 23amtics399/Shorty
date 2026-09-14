/**
 * Auth.js v5 configuration.
 * V1: Credentials provider (email + bcrypt password) only.
 * OAuth providers can be added later without rewriting this config.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/lib/db/models/User';
import { logger } from '@/lib/logger';

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        try {
          await connectToDatabase();
          // Explicitly select passwordHash (it's excluded by default)
          const user = await User.findOne({ email }).select('+passwordHash').lean();

          if (!user) return null;

          const passwordMatch = await bcrypt.compare(password, user.passwordHash);
          if (!passwordMatch) return null;

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name ?? null,
            role: user.role,
          };
        } catch (err) {
          logger.error('Auth error during credentials login', {
            error: err instanceof Error ? err.message : 'unknown',
          });
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'user' | 'admin';
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
});
