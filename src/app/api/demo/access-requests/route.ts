import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import AccessRequest from '@/models/AccessRequest';

// GET /api/demo/access-requests — list all (admin only)
export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isAdmin(user)) return err('Forbidden', 403);

  await connectDB();

  const requests = await AccessRequest.find({}).sort({ createdAt: -1 }).lean();

  return ok(
    requests.map((r) => ({
      _id:       r._id.toString(),
      name:      r.name,
      email:     r.email,
      useCase:   r.useCase ?? null,
      status:    r.status,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}
