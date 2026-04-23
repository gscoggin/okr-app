import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import InviteCode from '@/models/InviteCode';

// DELETE /api/invite-codes/[code] — revoke a code (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isAdmin(user)) return err('Forbidden', 403);

  const { code } = await params;

  await connectDB();

  const doc = await InviteCode.findOne({ code: code.toUpperCase() });
  if (!doc) return err('Code not found', 404);
  if (doc.usedAt) return err('Code has already been used and cannot be revoked');

  doc.revokedAt = new Date();
  await doc.save();

  return ok({ code: doc.code, status: 'revoked' });
}
