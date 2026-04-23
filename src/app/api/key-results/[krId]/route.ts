import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err, rejectIfDemo } from '@/lib/apiUtils';
import KeyResult from '@/models/KeyResult';
import Objective from '@/models/Objective';
import OKRPage from '@/models/OKRPage';
import { computeObjectiveScore } from '@/types';
import { authorizeKR } from '@/lib/authorization';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ krId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  const demoErr = rejectIfDemo(user); if (demoErr) return demoErr;

  const { krId } = await params;
  await connectDB();

  const ctx = await authorizeKR(user, krId);
  if (!ctx) return err('Forbidden or not found', 403);

  const body = await req.json();
  delete body.objectiveId; // immutable

  Object.assign(ctx.kr, body);
  await ctx.kr.save();

  // Auto-recompute objective score when KR score changes
  if (body.score !== undefined) {
    const allKRs = await KeyResult.find({ objectiveId: ctx.kr.objectiveId }).lean();
    const newScore = computeObjectiveScore(allKRs);
    await Objective.findByIdAndUpdate(ctx.kr.objectiveId, { score: newScore });
  }

  return ok(ctx.kr);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ krId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  const demoErr = rejectIfDemo(user); if (demoErr) return demoErr;

  const { krId } = await params;
  await connectDB();

  const ctx = await authorizeKR(user, krId);
  if (!ctx) return err('Forbidden or not found', 403);

  await KeyResult.findByIdAndDelete(krId);

  // Recompute objective score after deletion
  const remaining = await KeyResult.find({ objectiveId: ctx.kr.objectiveId }).lean();
  await Objective.findByIdAndUpdate(ctx.kr.objectiveId, {
    score: computeObjectiveScore(remaining),
  });

  return ok({ deleted: true });
}
