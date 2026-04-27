import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { signToken, AUTH_COOKIE } from '@/lib/auth';
import { ok, err } from '@/lib/apiUtils';
import { isRateLimited } from '@/lib/rateLimit';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(`login:${ip}`, 5, 15 * 60 * 1000)) {
    return err('Too many login attempts. Please try again later.', 429);
  }

  const { email, password } = await req.json();

  if (!email || !password) return err('Email and password are required');

  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return err('Invalid credentials', 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return err('Invalid credentials', 401);

  const payload = {
    userId: user._id.toString(),
    tenantId: user.tenantId.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    teamMemberships: user.teamMemberships.map((m) => ({
      teamId: m.teamId.toString(),
      role: m.role,
    })),
  };

  const token = signToken(payload);

  const res = ok({
    user: {
      _id: user._id.toString(),
      tenantId: user.tenantId.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      teamMemberships: payload.teamMemberships,
    },
  });

  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return res;
}
