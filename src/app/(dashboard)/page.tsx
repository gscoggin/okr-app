export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import { RingGauge } from '@/components/ui/RingGauge';
import { computePageScore, periodLabel } from '@/types';
import { getCurrentUser } from '@/lib/auth';
import Tenant from '@/models/Tenant';
import { serializeObjective } from '@/lib/serializeOKR';
import type { IObjective } from '@/types';

async function getCompanyData(tenantId: string) {
  await connectDB().catch(() => { throw new Error('db_unavailable'); });
  const currentYear = new Date().getFullYear();

  const [orgs, teams, pages, tenant] = await Promise.all([
    Org.find({ tenantId }).lean(),
    Team.find({ tenantId }).lean(),
    OKRPage.find({ tenantId, 'period.year': currentYear }).lean(),
    Tenant.findById(tenantId).lean(),
  ]);

  const pageIds = pages.map((p) => p._id);
  const objectives = await Objective.find({ okrPageId: { $in: pageIds } }).lean();

  const objsByPage: Record<string, IObjective[]> = {};
  for (const obj of objectives) {
    const key = obj.okrPageId.toString();
    if (!objsByPage[key]) objsByPage[key] = [];
    objsByPage[key].push(serializeObjective(obj, []));
  }

  return { orgs, teams, pages, objsByPage, currentYear, tenant };
}

export default async function CompanyDashboard() {
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const tenantId = currentUser?.tenantId ?? '';
  let data;
  try {
    data = await getCompanyData(tenantId);
  } catch {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg font-medium mb-2">Database unavailable</p>
          <p className="text-sm">Make sure MongoDB is running and <code className="bg-gray-100 px-1 rounded">MONGODB_URI</code> is set in <code className="bg-gray-100 px-1 rounded">.env.local</code>.</p>
        </div>
      </div>
    );
  }
  const { orgs, teams, pages, objsByPage, currentYear, tenant } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tenant?.name ?? 'Company'} OKRs</h1>
        {tenant?.branding?.mission && (
          <p className="text-sm text-blue-600 mt-0.5 italic">{tenant.branding.mission}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">{currentYear} — All organizations</p>
      </div>

      {orgs.length === 0 && (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg font-medium mb-2">No organizations yet</p>
          {isAdmin ? (
            <p className="text-sm">
              <Link href="/admin" className="text-blue-600 hover:underline font-medium">
                Go to Admin
              </Link>
              {' '}to create your first org and teams.
            </p>
          ) : (
            <p className="text-sm">An admin can create the first org and teams.</p>
          )}
        </div>
      )}

      {orgs.map((org) => {
        const orgTeams = teams.filter((t) => t.orgId.toString() === org._id.toString() && !t.parentTeamId);
        return (
          <section key={org._id.toString()} className="mb-10">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              {org.iconUrl && (
                <img src={org.iconUrl} alt="" className="w-6 h-6 rounded object-cover" />
              )}
              {org.name}
            </h2>

            <div className="space-y-2">
              {orgTeams.map((team) => {
                const teamPages = pages.filter((p) => p.teamId.toString() === team._id.toString());
                return (
                  <div key={team._id.toString()} className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden">
                    <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <Link
                        href={`/teams/${team._id}`}
                        className="font-medium text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition"
                      >
                        {team.name}
                      </Link>
                    </div>

                    {teamPages.length === 0 ? (
                      <p className="text-sm text-gray-400 px-4 py-3">No OKRs for {currentYear}</p>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {teamPages.map((pg) => {
                          const objs = objsByPage[pg._id.toString()] ?? [];
                          const score = computePageScore(objs);
                          const period = { type: pg.period.type, year: pg.period.year, quarter: pg.period.quarter };
                          const periodSlug =
                            pg.period.type === 'annual'
                              ? `${pg.period.year}`
                              : `${pg.period.year}/${pg.period.quarter?.toLowerCase()}`;
                          return (
                            <Link
                              key={pg._id.toString()}
                              href={`/teams/${team._id}/${periodSlug}`}
                              className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition gap-4"
                            >
                              <span className="text-sm text-gray-600 dark:text-gray-400 w-24">{periodLabel(period)}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pg.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}`}>
                                {pg.status}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">{objs.length} objective{objs.length !== 1 ? 's' : ''}</span>
                              <div className="ml-auto">
                                <RingGauge score={score ?? null} size={40} />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
