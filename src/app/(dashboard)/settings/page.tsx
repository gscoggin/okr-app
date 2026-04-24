export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getCurrentUser, isAdmin, isTenantOwner } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Tenant from '@/models/Tenant';
import { TenantSettingsEditor } from '@/components/settings/TenantSettingsEditor';
import type { ITenant } from '@/types';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!isAdmin(user)) redirect('/');

  await connectDB();
  const tenant = await Tenant.findById(user.tenantId).lean();
  if (!tenant) redirect('/');

  const serialized: ITenant = {
    _id: tenant._id.toString(),
    name: tenant.name,
    slug: tenant.slug,
    ownerId: tenant.ownerId.toString(),
    branding: tenant.branding ?? {},
    guidePage: tenant.guidePage,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };

  return <TenantSettingsEditor tenant={serialized} isTenantOwner={isTenantOwner(user)} />;
}
