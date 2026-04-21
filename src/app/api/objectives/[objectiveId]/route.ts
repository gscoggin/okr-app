import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin, isTeamOwner } from '@/lib/auth';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import OKRPage from '@/models/OKRPage';
import { computeObjectiveScore } from '@/types';

async function authorizeObjective(
  user: ReturnType<typeof requireAuth>,
  objectiveId: string
) {
  if (!user) return null;
  const objective = await Objective.findById(objectiveId);
  if (!objective) return null;
  const page = await OKRPage.findById(objective.okrPageId);
  if (!page) return null;
  // Tenant isolation: users can only act on objectives in their own tenant
  if (page.tenantId?.toString() !== user.tenantId) return null;
  if (!isAdmin(user) && !isTeamOwner(user, page.teamId.toString())) return null;
  return { objective, page };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { objectiveId } = await params;
  await connectDB();

  const objective = await Objective.findById(objectiveId).lean();
  if (!objective) return err('Objective not found', 404);
  const krs = await KeyResult.find({ objectiveId }).sort({ sortOrder: 1 }).lean();
  return ok({ ...objective, keyResults: krs });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { objectiveId } = await params;
  await connectDB();

  const ctx = await authorizeObjective(user, objectiveId);
  if (!ctx) return err('Forbidden or not found', 403);

  const body = await req.json();
  delete body.okrPageId; // immutable

  const prevScore = ctx.objective.score;
  Object.assign(ctx.objective, body);

  // Snapshot score when it changes (one entry per day — replace same-day entry)
  const newScore = ctx.objective.score;
  if (newScore != null && newScore !== prevScore) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const history = ctx.objective.scoreHistory.filter(
      (s: { date: Date }) => s.date.getTime() !== today.getTime()
    );
    history.push({ date: today, score: newScore });
    ctx.objective.scoreHistory = history;
  }

  await ctx.objective.save();
  return ok(ctx.objective);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { objectiveId } = await params;
  await connectDB();

  const ctx = await authorizeObjective(user, objectiveId);
  if (!ctx) return err('Forbidden or not found', 403);

  await KeyResult.deleteMany({ objectiveId });
  await Objective.findByIdAndDelete(objectiveId);
  return ok({ deleted: true });
}

/**
 * POST /api/objectives/[objectiveId]/recompute-score
 * Recomputes the objective score from its KR scores and saves it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { objectiveId } = await params;
  await connectDB();

  const objective = await Objective.findById(objectiveId);
  if (!objective) return err('Objective not found', 404);

  const krs = await KeyResult.find({ objectiveId }).lean();
  const score = computeObjectiveScore(krs);
  objective.score = score;
  await objective.save();

  return ok({ score });
}
