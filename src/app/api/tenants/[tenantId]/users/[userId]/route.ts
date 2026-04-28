import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isSuperAdmin } from '@/lib/auth';
import User from '@/models/User';
import Tenant from '@/models/Tenant';
import Team from '@/models/Team';
import mongoose from 'mongoose';
import type { UserRole } from '@/types';

const ALLOWED_ROLES: UserRole[] = ['tenant_owner', 'admin', 'member'];

type Params = { params: Promise<{ tenantId: string; userId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const caller = requireAuth(req);
  if (!caller) return err('Unauthorized', 401);
  if (!isSuperAdmin(caller)) return err('Forbidden', 403);

  const { tenantId, userId } = await params;
  if (!mongoose.Types.ObjectId.isValid(tenantId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return err('Invalid ID', 400);
  }

  // Super_admin cannot change their own role via this route
  if (userId === caller.userId) return err('Cannot modify your own account via this endpoint', 400);

  const body = await req.json().catch(() => ({}));
  const role: UserRole = body.role;

  if (!ALLOWED_ROLES.includes(role)) {
    return err(`Role must be one of: ${ALLOWED_ROLES.join(', ')}`, 400);
  }

  await connectDB();

  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) return err('Tenant not found', 404);

  const user = await User.findOne({
    _id: new mongoose.Types.ObjectId(userId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });
  if (!user) return err('User not found', 404);

  user.role = role;
  await user.save();

  return ok({ _id: user._id.toString(), role: user.role });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const caller = requireAuth(req);
  if (!caller) return err('Unauthorized', 401);
  if (!isSuperAdmin(caller)) return err('Forbidden', 403);

  const { tenantId, userId } = await params;
  if (!mongoose.Types.ObjectId.isValid(tenantId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return err('Invalid ID', 400);
  }

  if (userId === caller.userId) return err('Cannot delete your own account', 400);

  await connectDB();

  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) return err('Tenant not found', 404);

  const user = await User.findOne({
    _id: new mongoose.Types.ObjectId(userId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });
  if (!user) return err('User not found', 404);

  // Remove from all team memberships in this tenant
  await Team.updateMany(
    { tenantId: new mongoose.Types.ObjectId(tenantId) },
    { $pull: { members: { userId: new mongoose.Types.ObjectId(userId) } } }
  );

  await user.deleteOne();

  return ok({ deleted: true });
}
