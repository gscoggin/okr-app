import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import OKRPage from '@/models/OKRPage';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  await connectDB();

  const result = await OKRPage.aggregate([
    { $group: { _id: '$period.year' } },
    { $sort: { _id: -1 } },
  ]);

  const years: number[] = result.map((r: { _id: number }) => r._id).filter(Boolean);
  return ok(years);
}
