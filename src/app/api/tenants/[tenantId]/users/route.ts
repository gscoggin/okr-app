import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isSuperAdmin } from '@/lib/auth';
import User from '@/models/User';
import Tenant from '@/models/Tenant';
import mongoose from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isSuperAdmin(user)) return err('Forbidden', 403);

  const { tenantId } = await params;
  if (!mongoose.Types.ObjectId.isValid(tenantId)) return err('Invalid tenant ID', 400);

  await connectDB();

  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) return err('Tenant not found', 404);

  const users = await User.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
    .sort({ createdAt: 1 })
    .lean();

  return ok(
    users.map((u) => ({
      _id:       u._id.toString(),
      name:      u.name,
      email:     u.email,
      role:      u.role,
      createdAt: u.createdAt.toISOString(),
    }))
  );
}
