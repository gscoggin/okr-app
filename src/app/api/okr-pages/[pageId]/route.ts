import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err, rejectIfDemo } from '@/lib/apiUtils';
import { isAdmin, isTeamOwner } from '@/lib/auth';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

/** Full OKR page with nested objectives + key results */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { pageId } = await params;
  await connectDB();

  const page = await OKRPage.findOne({ _id: pageId, tenantId: user.tenantId }).lean();
  if (!page) return err('OKR page not found', 404);

  const objectives = await Objective.find({ okrPageId: pageId })
    .sort({ sortOrder: 1 })
    .lean();

  const objectiveIds = objectives.map((o) => o._id);
  const keyResults = await KeyResult.find({ objectiveId: { $in: objectiveIds } })
    .sort({ sortOrder: 1 })
    .lean();

  // Nest KRs under their objective
  const krsByObjective = keyResults.reduce<Record<string, typeof keyResults>>(
    (acc, kr) => {
      const key = kr.objectiveId.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(kr);
      return acc;
    },
    {}
  );

  const nested = objectives.map((o) => ({
    ...o,
    keyResults: krsByObjective[o._id.toString()] ?? [],
  }));

  return ok({ ...page, objectives: nested });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  const demoErr = rejectIfDemo(user); if (demoErr) return demoErr;

  const { pageId } = await params;
  await connectDB();

  const page = await OKRPage.findOne({ _id: pageId, tenantId: user.tenantId });
  if (!page) return err('OKR page not found', 404);

  const teamId = page.teamId.toString();
  if (!isAdmin(user) && !isTeamOwner(user, teamId)) return err('Forbidden', 403);

  const body = await req.json();

  // Publishing validation
  if (body.status === 'published') {
    const objectives = await Objective.find({ okrPageId: pageId }).lean();
    if (objectives.length === 0) {
      return err('Add at least one objective before publishing.', 422);
    }
    const objectiveIds = objectives.map((o) => o._id);
    const krs = await KeyResult.find({ objectiveId: { $in: objectiveIds } }).lean();
    const missingOwners = krs.filter((kr) => !kr.owners || kr.owners.length === 0);
    if (missingOwners.length > 0) {
      return err(`${missingOwners.length} key result(s) have no owner assigned.`, 422);
    }
  }

  Object.assign(page, body);
  await page.save();
  return ok(page);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { pageId } = await params;
  await connectDB();

  const page = await OKRPage.findOne({ _id: pageId, tenantId: user.tenantId });
  if (!page) return err('OKR page not found', 404);

  if (!isAdmin(user) && !isTeamOwner(user, page.teamId.toString())) return err('Forbidden', 403);

  // Cascade delete objectives and key results
  const objectives = await Objective.find({ okrPageId: pageId }).select('_id').lean();
  const objectiveIds = objectives.map((o) => o._id);
  await KeyResult.deleteMany({ objectiveId: { $in: objectiveIds } });
  await Objective.deleteMany({ okrPageId: pageId });
  await OKRPage.findByIdAndDelete(pageId);

  return ok({ deleted: true });
}
