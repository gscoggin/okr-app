import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isSuperAdmin } from '@/lib/auth';
import { isRateLimited } from '@/lib/rateLimit';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import Archive from '@/models/Archive';
import InviteCode from '@/models/InviteCode';
import mongoose from 'mongoose';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isSuperAdmin(user)) return err('Forbidden', 403);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(`delete-tenant:${ip}`, 5, 60 * 60 * 1000)) {
    return err('Too many requests. Please try again later.', 429);
  }

  const { tenantId } = await params;

  if (!mongoose.Types.ObjectId.isValid(tenantId)) return err('Invalid tenant ID', 400);

  // Prevent deleting the super_admin's own tenant
  if (tenantId === user.tenantId) {
    return err('Cannot delete your own workspace', 400);
  }

  await connectDB();

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return err('Tenant not found', 404);

  const tid = new mongoose.Types.ObjectId(tenantId);

  // Cascade: find all pages first to get objective ids, then KR ids
  const pages = await OKRPage.find({ tenantId: tid }, '_id').lean();
  const pageIds = pages.map((p) => p._id);

  const objectives = await Objective.find({ okrPageId: { $in: pageIds } }, '_id').lean();
  const objectiveIds = objectives.map((o) => o._id);

  const [krResult, objResult, pageResult, teamResult, orgResult,
         archiveResult, codeResult, userResult] = await Promise.all([
    KeyResult.deleteMany({ objectiveId: { $in: objectiveIds } }),
    Objective.deleteMany({ okrPageId: { $in: pageIds } }),
    OKRPage.deleteMany({ tenantId: tid }),
    Team.deleteMany({ tenantId: tid }),
    Org.deleteMany({ tenantId: tid }),
    Archive.deleteMany({ tenantId: tid }),
    InviteCode.deleteMany({ tenantId: tid }),
    User.deleteMany({ tenantId: tid }),
  ]);

  await Tenant.findByIdAndDelete(tenantId);

  console.log(`[super_admin] Deleted tenant ${tenant.name} (${tenantId}) by ${user.email}`);

  return ok({
    deleted: {
      keyResults:  krResult.deletedCount,
      objectives:  objResult.deletedCount,
      okrPages:    pageResult.deletedCount,
      teams:       teamResult.deletedCount,
      orgs:        orgResult.deletedCount,
      archives:    archiveResult.deletedCount,
      inviteCodes: codeResult.deletedCount,
      users:       userResult.deletedCount,
    },
  });
}
