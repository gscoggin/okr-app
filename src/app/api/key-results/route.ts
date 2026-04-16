import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin, isTeamOwner } from '@/lib/auth';
import KeyResult from '@/models/KeyResult';
import Objective from '@/models/Objective';
import OKRPage from '@/models/OKRPage';

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const {
    objectiveId,
    title,
    owners,
    metric,
    startValue,
    targetValue,
    currentValue,
    confidence,
    comments,
    sortOrder,
  } = await req.json();

  if (!objectiveId) return err('objectiveId is required');

  await connectDB();

  const objective = await Objective.findById(objectiveId);
  if (!objective) return err('Objective not found', 404);

  const page = await OKRPage.findById(objective.okrPageId);
  if (!page) return err('OKR page not found', 404);
  if (!isAdmin(user) && !isTeamOwner(user, page.teamId.toString())) return err('Forbidden', 403);

  const count = await KeyResult.countDocuments({ objectiveId });
  const kr = await KeyResult.create({
    objectiveId,
    title,
    owners: owners ?? [],
    metric,
    startValue,
    targetValue,
    currentValue,
    confidence,
    comments,
    sortOrder: sortOrder ?? count,
  });

  return ok(kr, 201);
}
