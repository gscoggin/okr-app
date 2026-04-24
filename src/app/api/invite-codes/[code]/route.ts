import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin, isSuperAdmin } from '@/lib/auth';
import InviteCode from '@/models/InviteCode';
import Tenant from '@/models/Tenant';

type Params = { params: Promise<{ code: string }> };

// GET /api/invite-codes/[code] — public peek (type + tenant name for UI adaptation)
export async function GET(
  _req: NextRequest,
  { params }: Params
) {
  const { code } = await params;

  await connectDB();

  const doc = await InviteCode.findOne({ code: code.toUpperCase() }).lean();
  if (!doc) return err('Code not found', 404);

  let tenantName: string | undefined;
  if (doc.type === 'workspace_join' && doc.tenantId) {
    const tenant = await Tenant.findById(doc.tenantId).lean();
    tenantName = tenant?.name;
  }

  return ok({ type: doc.type, tenantName: tenantName ?? null });
}

// DELETE /api/invite-codes/[code] — revoke a code
// super_admin: any code; admin/tenant_owner: only their tenant's workspace_join codes
export async function DELETE(
  req: NextRequest,
  { params }: Params
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isAdmin(user)) return err('Forbidden', 403);

  const { code } = await params;

  await connectDB();

  const doc = await InviteCode.findOne({ code: code.toUpperCase() });
  if (!doc) return err('Code not found', 404);

  if (!isSuperAdmin(user)) {
    if (
      doc.type !== 'workspace_join' ||
      doc.tenantId?.toString() !== user.tenantId
    ) {
      return err('Forbidden', 403);
    }
  }

  if (doc.usedAt) return err('Code has already been used and cannot be revoked');

  doc.revokedAt = new Date();
  await doc.save();

  return ok({ code: doc.code, status: 'revoked' });
}
