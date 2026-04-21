import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import { ok, err } from '@/lib/apiUtils';
import { sendPasswordResetEmail } from '@/lib/email';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return err('Email is required');

  await connectDB();

  // Always return success to avoid leaking whether an email exists
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return ok({ sent: true });

  const token = crypto.randomBytes(32).toString('hex');
  user.resetToken = token;
  user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  try {
    await sendPasswordResetEmail(user.email, token);
  } catch (e) {
    console.error('[forgot-password] Resend error:', e);
    return err('Failed to send reset email', 500);
  }

  return ok({ sent: true });
}
