import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  await connectDB();

  const filter = q
    ? { $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] }
    : {};

  const users = await User.find(filter)
    .select('name email')
    .limit(20)
    .lean();

  return ok(users.map((u) => ({ _id: u._id.toString(), name: u.name, email: u.email })));
}
