import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { ok, err } from '@/lib/apiUtils';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return err('Token and password are required');
  if (password.length < 8)   return err('Password must be at least 8 characters');
  if (password.length > 128) return err('Password must be 128 characters or fewer');

  await connectDB();

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: new Date() },
  });

  if (!user) return err('Invalid or expired reset link', 400);

  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  return ok({ reset: true });
}
