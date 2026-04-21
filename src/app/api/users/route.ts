import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  await connectDB();

  const tenantFilter = { tenantId: user.tenantId };
  const filter = q
    ? { ...tenantFilter, $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] }
    : tenantFilter;

  const query = User.find(filter).select('name email role');
  // Admins get all users; regular users get a capped search for owner-pickers
  if (!isAdmin(user)) query.limit(20);

  const users = await query.lean();
  return ok(users.map((u) => ({
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
  })));
}

export async function POST(req: NextRequest) {
  const requester = requireAuth(req);
  if (!requester || !isAdmin(requester)) return err('Forbidden', 403);

  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) return err('Name, email and password are required');
  if (password.length < 8) return err('Password must be at least 8 characters');

  // Admins can create admins and members; only tenant_owner can create other tenant_owners
  const allowedRoles = ['admin', 'member'];
  if (requester.role === 'tenant_owner' || requester.role === 'super_admin') {
    allowedRoles.push('tenant_owner');
  }
  if (role && !allowedRoles.includes(role)) return err('Invalid role', 400);

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already in use', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = await User.create({
    tenantId: requester.tenantId,
    name,
    email,
    passwordHash,
    role: role ?? 'member',
  });

  return ok({
    _id: newUser._id.toString(),
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
  }, 201);
}
