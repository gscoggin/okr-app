export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Tenant from '@/models/Tenant';

export default async function GuidePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDB();
  const tenant = await Tenant.findById(user.tenantId).lean();

  const isAdmin = user ? ['super_admin', 'tenant_owner', 'admin'].includes(user.role) : false;
  const content = tenant?.guidePage?.trim() ?? '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guide</h1>
          <p className="text-sm text-gray-500 mt-1">{tenant?.name} — OKR practices and resources</p>
        </div>
        {isAdmin && (
          <Link
            href="/settings"
            className="text-xs text-blue-600 hover:underline"
          >
            Edit in Settings →
          </Link>
        )}
      </div>

      {content ? (
        <div className="border border-gray-200 rounded-xl bg-white p-6">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
            {content}
          </pre>
        </div>
      ) : (
        <div className="border border-dashed border-gray-200 rounded-xl bg-gray-50 p-12 text-center">
          <p className="text-gray-400 text-sm font-medium mb-1">No guide yet</p>
          <p className="text-gray-400 text-xs">
            {isAdmin
              ? 'Add OKR best practices and company norms in Settings → Guide Page.'
              : 'Your workspace admin hasn\'t added a guide yet.'}
          </p>
          {isAdmin && (
            <Link
              href="/settings"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Add guide content
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
