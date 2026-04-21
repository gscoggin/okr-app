import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import OKRPage from '@/models/OKRPage';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  await connectDB();

  const result = await OKRPage.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(user.tenantId) } },
    { $group: { _id: '$period.year' } },
    { $sort: { _id: -1 } },
  ]);

  const years: number[] = result.map((r: { _id: number }) => r._id).filter(Boolean);
  return ok(years);
}
