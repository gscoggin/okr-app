import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin, isTeamOwner } from '@/lib/auth';
import Team from '@/models/Team';
import Org from '@/models/Org';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { teamId } = await params;
  await connectDB();
  const team = await Team.findOne({ _id: teamId, tenantId: user.tenantId }).populate('subTeams').lean();
  if (!team) return err('Team not found', 404);
  return ok(team);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { teamId } = await params;
  if (!isAdmin(user) && !isTeamOwner(user, teamId)) return err('Forbidden', 403);

  const body = await req.json();
  // Prevent overwriting protected fields
  delete body.orgId;
  delete body.slug;

  await connectDB();
  const team = await Team.findByIdAndUpdate(teamId, body, { new: true });
  if (!team) return err('Team not found', 404);
  return ok(team);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { teamId } = await params;
  await connectDB();

  // Cascade: OKR pages → objectives → key results
  const pages = await OKRPage.find({ teamId }).select('_id').lean();
  const pageIds = pages.map((p) => p._id);
  const objectives = await Objective.find({ okrPageId: { $in: pageIds } }).select('_id').lean();
  const objectiveIds = objectives.map((o) => o._id);

  await KeyResult.deleteMany({ objectiveId: { $in: objectiveIds } });
  await Objective.deleteMany({ okrPageId: { $in: pageIds } });
  await OKRPage.deleteMany({ teamId });

  // Remove team from its org and detach any sub-teams
  const team = await Team.findById(teamId);
  if (team) {
    await Org.findByIdAndUpdate(team.orgId, { $pull: { teams: team._id } });
    await Team.updateMany({ parentTeamId: teamId }, { $unset: { parentTeamId: '' } });
  }
  await Team.findByIdAndDelete(teamId);

  return ok({ deleted: true });
}
