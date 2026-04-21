import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import Tenant from '@/models/Tenant';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  await connectDB();
  const tenant = await Tenant.findById(user.tenantId).lean();
  if (!tenant) return err('Tenant not found', 404);
  return ok(tenant);
}

export async function PATCH(req: NextRequest) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const body = await req.json();

  // Only allow safe fields to be patched
  const allowed: Record<string, unknown> = {};
  if (body.name !== undefined) allowed.name = body.name;
  if (body.guidePage !== undefined) allowed.guidePage = body.guidePage;
  if (body.branding !== undefined) {
    allowed['branding.logoUrl'] = body.branding.logoUrl;
    allowed['branding.mission'] = body.branding.mission;
    allowed['branding.primaryColor'] = body.branding.primaryColor;
  }

  await connectDB();
  const tenant = await Tenant.findByIdAndUpdate(
    user.tenantId,
    { $set: allowed },
    { new: true }
  );
  if (!tenant) return err('Tenant not found', 404);
  return ok(tenant);
}
