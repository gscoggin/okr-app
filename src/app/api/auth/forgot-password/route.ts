import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import { ok, err } from '@/lib/apiUtils';
import { sendPasswordResetEmail } from '@/lib/email';
import User from '@/models/User';

// Simple in-memory rate limit: max 3 requests per email per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_ATTEMPTS) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return err('Email is required');

  if (isRateLimited(email.toLowerCase())) {
    return err('Too many requests. Please try again later.', 429);
  }

  await connectDB();

  // Always return success to avoid leaking whether an email exists
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return ok({ sent: true });

  const token = crypto.randomBytes(32).toString('hex');
  user.resetToken = token;
  user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const sent = await sendPasswordResetEmail(user.email, token);
  if (!sent) return err('Failed to send reset email. Please try again.', 500);

  return ok({ sent: true });
}
