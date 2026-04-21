import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin, isTenantOwner } from '@/lib/auth';
import User from '@/models/User';
import Team from '@/models/Team';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requester = requireAuth(req);
  if (!requester || !isAdmin(requester)) return err('Forbidden', 403);

  const { userId } = await params;
  const { role } = await req.json();
  if (!role) return err('role is required');

  // Only tenant_owner can assign tenant_owner or admin roles
  const elevated = ['tenant_owner', 'admin'];
  if (elevated.includes(role) && !isTenantOwner(requester)) return err('Forbidden', 403);

  await connectDB();
  const user = await User.findOne({ _id: userId, tenantId: requester.tenantId });
  if (!user) return err('User not found', 404);

  // Protect tenant_owner from being demoted by a plain admin
  if (user.role === 'tenant_owner' && !isTenantOwner(requester)) {
    return err('Cannot change the workspace owner role', 403);
  }

  user.role = role;
  await user.save();
  return ok({ _id: user._id.toString(), name: user.name, email: user.email, role: user.role });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requester = requireAuth(req);
  if (!requester || !isAdmin(requester)) return err('Forbidden', 403);

  const { userId } = await params;

  if (requester.userId === userId) return err('You cannot delete your own account', 400);

  await connectDB();
  const user = await User.findOne({ _id: userId, tenantId: requester.tenantId });
  if (!user) return err('User not found', 404);

  // Remove user from all team member lists
  await Team.updateMany(
    { 'members.userId': userId },
    { $pull: { members: { userId } } }
  );

  await User.findByIdAndDelete(userId);
  return ok({ deleted: true });
}
