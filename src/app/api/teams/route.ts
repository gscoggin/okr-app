import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err, slugify } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import Team from '@/models/Team';
import Org from '@/models/Org';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');

  await connectDB();
  const filter = orgId ? { orgId } : {};
  const teams = await Team.find(filter).sort({ name: 1 }).lean();
  return ok(teams);
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { name, orgId, parentTeamId } = await req.json();
  if (!name || !orgId) return err('Name and orgId are required');

  await connectDB();

  const org = await Org.findById(orgId);
  if (!org) return err('Org not found', 404);

  const slug = slugify(name);
  const team = await Team.create({ name, slug, orgId, parentTeamId });

  // Register team with org
  org.teams.push(team._id);
  await org.save();

  // Register as sub-team if parentTeamId provided
  if (parentTeamId) {
    await Team.findByIdAndUpdate(parentTeamId, { $push: { subTeams: team._id } });
  }

  return ok(team, 201);
}
