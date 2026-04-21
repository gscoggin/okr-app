import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import Team from '@/models/Team';
import User from '@/models/User';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { teamId } = await params;
  const { userId, role } = await req.json();
  if (!userId || !role) return err('userId and role are required', 400);
  if (!['owner', 'member'].includes(role)) return err('role must be owner or member', 400);

  await connectDB();

  const [team, targetUser] = await Promise.all([
    Team.findById(teamId),
    User.findById(userId),
  ]);
  if (!team) return err('Team not found', 404);
  if (team.tenantId?.toString() !== user.tenantId) return err('Forbidden', 403);
  if (!targetUser) return err('User not found', 404);
  if (targetUser.tenantId?.toString() !== user.tenantId) return err('Forbidden', 403);

  // Update Team.members
  const existingMember = team.members.find((m: { userId: { toString(): string }; role: string }) => m.userId.toString() === userId);
  if (existingMember) {
    existingMember.role = role;
  } else {
    team.members.push({ userId, role });
  }
  await team.save();

  // Update User.teamMemberships
  const existingMembership = targetUser.teamMemberships.find(
    (m: { teamId: { toString(): string }; role: string }) => m.teamId.toString() === teamId
  );
  if (existingMembership) {
    existingMembership.role = role;
  } else {
    targetUser.teamMemberships.push({ teamId: new mongoose.Types.ObjectId(teamId), role });
  }
  await targetUser.save();

  return ok({ teamId, userId, role });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { teamId } = await params;
  const { userId } = await req.json();
  if (!userId) return err('userId is required', 400);

  await connectDB();

  const [team, targetUser] = await Promise.all([
    Team.findById(teamId),
    User.findById(userId),
  ]);
  if (!team) return err('Team not found', 404);
  if (team.tenantId?.toString() !== user.tenantId) return err('Forbidden', 403);
  if (!targetUser) return err('User not found', 404);
  if (targetUser.tenantId?.toString() !== user.tenantId) return err('Forbidden', 403);

  team.members = team.members.filter((m: { userId: { toString(): string } }) => m.userId.toString() !== userId);
  await team.save();

  targetUser.teamMemberships = targetUser.teamMemberships.filter(
    (m: { teamId: { toString(): string } }) => m.teamId.toString() !== teamId
  );
  await targetUser.save();

  return ok({ removed: true });
}
