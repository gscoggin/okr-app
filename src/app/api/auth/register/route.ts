/**
 * Registration endpoint — admin-only in production.
 * In dev, the first user to register is automatically made admin.
 */
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { ok, err } from '@/lib/apiUtils';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) return err('Name, email and password are required');
  if (password.length < 8) return err('Password must be at least 8 characters');

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already in use', 409);

  const userCount = await User.countDocuments();
  const role = userCount === 0 ? 'admin' : 'member'; // first user = admin

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role });

  return ok(
    { _id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    201
  );
}
