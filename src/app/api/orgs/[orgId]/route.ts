import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { orgId } = await params;
  await connectDB();
  const org = await Org.findOne({ _id: orgId, tenantId: user.tenantId }).populate('teams').lean();
  if (!org) return err('Org not found', 404);
  return ok(org);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { orgId } = await params;
  const body = await req.json();
  await connectDB();
  const org = await Org.findOneAndUpdate({ _id: orgId, tenantId: user.tenantId }, body, { new: true });
  if (!org) return err('Org not found', 404);
  return ok(org);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { orgId } = await params;
  await connectDB();

  const org = await Org.findOne({ _id: orgId, tenantId: user.tenantId });
  if (!org) return err('Org not found', 404);

  // Cascade: teams → OKR pages → objectives → key results
  const teams = await Team.find({ orgId }).select('_id').lean();
  const teamIds = teams.map((t) => t._id);
  const pages = await OKRPage.find({ teamId: { $in: teamIds } }).select('_id').lean();
  const pageIds = pages.map((p) => p._id);
  const objectives = await Objective.find({ okrPageId: { $in: pageIds } }).select('_id').lean();
  const objectiveIds = objectives.map((o) => o._id);

  await KeyResult.deleteMany({ objectiveId: { $in: objectiveIds } });
  await Objective.deleteMany({ okrPageId: { $in: pageIds } });
  await OKRPage.deleteMany({ teamId: { $in: teamIds } });
  await Team.deleteMany({ orgId });
  await org.deleteOne();

  return ok({ deleted: true });
}
