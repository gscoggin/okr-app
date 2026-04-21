import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { ok, err, slugify } from '@/lib/apiUtils';
import User from '@/models/User';
import Tenant from '@/models/Tenant';

export async function POST(req: NextRequest) {
  const { name, email, password, companyName, inviteCode } = await req.json();

  // If REGISTRATION_CODE is set, enforce it
  const requiredCode = process.env.REGISTRATION_CODE;
  if (requiredCode) {
    if (!inviteCode || inviteCode.trim() !== requiredCode.trim()) {
      return err('Invalid invite code', 403);
    }
  }

  if (!name || !email || !password) return err('Name, email and password are required');
  if (!companyName) return err('Company name is required');
  if (password.length < 8) return err('Password must be at least 8 characters');

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already in use', 409);

  // Create tenant first
  const baseSlug = slugify(companyName);
  let slug = baseSlug;
  let attempt = 1;
  while (await Tenant.findOne({ slug })) {
    slug = `${baseSlug}-${++attempt}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Use a placeholder ownerId, then update after user creation
  const tenant = await Tenant.create({
    name: companyName,
    slug,
    ownerId: new (await import('mongoose')).default.Types.ObjectId(),
    branding: {},
  });

  const user = await User.create({
    tenantId: tenant._id,
    name,
    email,
    passwordHash,
    role: 'tenant_owner',
  });

  // Point tenant.ownerId at the real user
  await Tenant.findByIdAndUpdate(tenant._id, { ownerId: user._id });

  return ok(
    {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: tenant._id.toString(),
      tenantName: tenant.name,
    },
    201
  );
}
