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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guide</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tenant?.name} — OKR practices and resources</p>
        </div>
        {isAdmin && (
          <Link
            href="/settings"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Edit in Settings →
          </Link>
        )}
      </div>

      {content ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 p-6">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
            {content}
          </pre>
        </div>
      ) : (
        <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-12 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm font-medium mb-1">No guide yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs">
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
