import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { ok, err, slugify } from '@/lib/apiUtils';
import User from '@/models/User';
import Tenant from '@/models/Tenant';
import InviteCode from '@/models/InviteCode';

export async function POST(req: NextRequest) {
  const { name, email, password, companyName, inviteCode } = await req.json();

  if (!inviteCode?.trim()) return err('An invite code is required', 403);

  await connectDB();

  const codeDoc = await InviteCode.findOne({ code: inviteCode.trim().toUpperCase() });

  if (!codeDoc)                         return err('Invite code not found', 403);
  if (codeDoc.usedAt)                   return err('This invite code has already been used', 403);
  if (codeDoc.revokedAt)                return err('This invite code has been revoked', 403);
  if (codeDoc.expiresAt < new Date())   return err('This invite code has expired', 403);

  if (!name || !email || !password) return err('Name, email and password are required');
  if (password.length < 8) return err('Password must be at least 8 characters');

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already in use', 409);

  const passwordHash = await bcrypt.hash(password, 12);

  if (codeDoc.type === 'workspace_join') {
    if (!codeDoc.tenantId) return err('Invalid invite code configuration', 500);

    const tenant = await Tenant.findById(codeDoc.tenantId).lean();
    if (!tenant) return err('Workspace not found', 404);

    const user = await User.create({
      tenantId: tenant._id,
      name,
      email,
      passwordHash,
      role: 'member',
    });

    codeDoc.usedBy = user._id;
    codeDoc.usedAt = new Date();
    await codeDoc.save();

    return ok(
      {
        _id:        user._id.toString(),
        name:       user.name,
        email:      user.email,
        role:       user.role,
        tenantId:   tenant._id.toString(),
        tenantName: tenant.name,
      },
      201
    );
  }

  // workspace_create — new tenant + tenant_owner
  if (!companyName) return err('Company name is required');

  const baseSlug = slugify(companyName);
  let slug = baseSlug;
  let attempt = 1;
  while (await Tenant.findOne({ slug })) {
    slug = `${baseSlug}-${++attempt}`;
  }

  const { default: mongoose } = await import('mongoose');
  const tenant = await Tenant.create({
    name: companyName,
    slug,
    ownerId: new mongoose.Types.ObjectId(),
    branding: {},
  });

  const user = await User.create({
    tenantId: tenant._id,
    name,
    email,
    passwordHash,
    role: 'tenant_owner',
  });

  await Tenant.findByIdAndUpdate(tenant._id, { ownerId: user._id });

  codeDoc.usedBy = user._id;
  codeDoc.usedAt = new Date();
  await codeDoc.save();

  return ok(
    {
      _id:        user._id.toString(),
      name:       user.name,
      email:      user.email,
      role:       user.role,
      tenantId:   tenant._id.toString(),
      tenantName: tenant.name,
    },
    201
  );
}
