import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import AccessRequest from '@/models/AccessRequest';

// PATCH /api/demo/access-requests/[id] — update status (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isAdmin(user)) return err('Forbidden', 403);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status;

  if (!['pending', 'approved', 'declined'].includes(status)) {
    return err('Invalid status');
  }

  await connectDB();

  const doc = await AccessRequest.findByIdAndUpdate(id, { status }, { new: true });
  if (!doc) return err('Not found', 404);

  return ok({ _id: doc._id.toString(), status: doc.status });
}
