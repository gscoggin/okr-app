import { requireAuth } from '@/lib/apiUtils';
import { isAdmin, isTeamOwner } from '@/lib/auth';
import KeyResult from '@/models/KeyResult';
import Objective from '@/models/Objective';
import OKRPage from '@/models/OKRPage';

export async function authorizeObjective(
  user: ReturnType<typeof requireAuth>,
  objectiveId: string
) {
  if (!user) return null;
  const objective = await Objective.findById(objectiveId);
  if (!objective) return null;
  const page = await OKRPage.findById(objective.okrPageId);
  if (!page) return null;
  if (page.tenantId?.toString() !== user.tenantId) return null;
  if (!isAdmin(user) && !isTeamOwner(user, page.teamId.toString())) return null;
  return { objective, page };
}

export async function authorizeKR(
  user: ReturnType<typeof requireAuth>,
  krId: string
) {
  if (!user) return null;
  const kr = await KeyResult.findById(krId);
  if (!kr) return null;
  const objective = await Objective.findById(kr.objectiveId);
  if (!objective) return null;
  const page = await OKRPage.findById(objective.okrPageId);
  if (!page) return null;
  if (page.tenantId?.toString() !== user.tenantId) return null;
  if (!isAdmin(user) && !isTeamOwner(user, page.teamId.toString())) return null;
  return { kr, objective, page };
}
