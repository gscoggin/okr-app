import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err, slugify } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import Org from '@/models/Org';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  await connectDB();
  const orgs = await Org.find({}).sort({ name: 1 }).lean();
  return ok(orgs);
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { name } = await req.json();
  if (!name) return err('Name is required');

  await connectDB();
  const slug = slugify(name);
  const org = await Org.create({ name, slug });
  return ok(org, 201);
}
