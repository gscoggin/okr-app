import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isSuperAdmin } from '@/lib/auth';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import Team from '@/models/Team';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isSuperAdmin(user)) return err('Forbidden', 403);

  await connectDB();

  const tenants = await Tenant.find({}).sort({ createdAt: -1 }).lean();
  const tenantIds = tenants.map((t) => t._id);

  const [userCounts, teamCounts] = await Promise.all([
    User.aggregate([
      { $match: { tenantId: { $in: tenantIds } } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]),
    Team.aggregate([
      { $match: { tenantId: { $in: tenantIds } } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]),
  ]);

  const userCountMap = new Map(userCounts.map((r: { _id: mongoose.Types.ObjectId; count: number }) => [r._id.toString(), r.count]));
  const teamCountMap = new Map(teamCounts.map((r: { _id: mongoose.Types.ObjectId; count: number }) => [r._id.toString(), r.count]));

  return ok(
    tenants.map((t) => ({
      _id:        t._id.toString(),
      name:       t.name,
      slug:       t.slug,
      isDemo:     t.isDemo ?? false,
      userCount:  userCountMap.get(t._id.toString()) ?? 0,
      teamCount:  teamCountMap.get(t._id.toString()) ?? 0,
      createdAt:  t.createdAt.toISOString(),
    }))
  );
}
