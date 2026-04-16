import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import User from '@/models/User';
import Team from '@/models/Team';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requester = requireAuth(req);
  if (!requester || !isAdmin(requester)) return err('Forbidden', 403);

  const { userId } = await params;

  if (requester.userId === userId) return err('You cannot delete your own account', 400);

  await connectDB();
  const user = await User.findById(userId);
  if (!user) return err('User not found', 404);

  // Remove user from all team member lists
  await Team.updateMany(
    { 'members.userId': userId },
    { $pull: { members: { userId } } }
  );

  await User.findByIdAndDelete(userId);
  return ok({ deleted: true });
}
