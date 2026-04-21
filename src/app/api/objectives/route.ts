import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin, isTeamOwner } from '@/lib/auth';
import Objective from '@/models/Objective';
import OKRPage from '@/models/OKRPage';

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { okrPageId, title, owners, priority, comments, parentObjectiveId, sortOrder } =
    await req.json();

  if (!okrPageId) return err('okrPageId is required');

  await connectDB();

  const page = await OKRPage.findById(okrPageId);
  if (!page) return err('OKR page not found', 404);
  if (page.tenantId?.toString() !== user.tenantId) return err('Forbidden', 403);
  if (!isAdmin(user) && !isTeamOwner(user, page.teamId.toString())) return err('Forbidden', 403);

  const count = await Objective.countDocuments({ okrPageId });
  try {
    const objective = await Objective.create({
      okrPageId,
      title,
      owners: owners ?? [],
      priority,
      comments,
      parentObjectiveId,
      sortOrder: sortOrder ?? count,
    });
    return ok(objective, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(msg, 500);
  }
}
