export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import { computePageScore, periodLabel } from '@/types';
import { getCurrentUser } from '@/lib/auth';
import type { IObjective } from '@/types';

async function getCompanyData() {
  await connectDB().catch(() => { throw new Error('db_unavailable'); });
  const currentYear = new Date().getFullYear();

  const [orgs, teams, pages] = await Promise.all([
    Org.find({}).lean(),
    Team.find({}).lean(),
    OKRPage.find({ 'period.year': currentYear }).lean(),
  ]);

  const pageIds = pages.map((p) => p._id);
  const objectives = await Objective.find({ okrPageId: { $in: pageIds } }).lean();

  const objsByPage: Record<string, IObjective[]> = {};
  for (const obj of objectives) {
    const key = obj.okrPageId.toString();
    if (!objsByPage[key]) objsByPage[key] = [];
    objsByPage[key].push({ ...obj, _id: obj._id.toString(), okrPageId: key, keyResults: [], owners: obj.owners ?? [], createdAt: obj.createdAt.toISOString(), updatedAt: obj.updatedAt.toISOString(), sortOrder: obj.sortOrder ?? 0, status: obj.status ?? 'draft', parentObjectiveId: obj.parentObjectiveId?.toString() });
  }

  return { orgs, teams, pages, objsByPage, currentYear };
}

export default async function CompanyDashboard() {
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  let data;
  try {
    data = await getCompanyData();
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
  const { orgs, teams, pages, objsByPage, currentYear } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company OKRs</h1>
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
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              {org.iconUrl && (
                <img src={org.iconUrl} alt="" className="w-6 h-6 rounded object-cover" />
              )}
              {org.name}
            </h2>

            <div className="space-y-2">
              {orgTeams.map((team) => {
                const teamPages = pages.filter((p) => p.teamId.toString() === team._id.toString());
                return (
                  <div key={team._id.toString()} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                    <div className="flex items-center px-4 py-3 border-b border-gray-100">
                      <Link
                        href={`/teams/${team._id}`}
                        className="font-medium text-gray-800 hover:text-blue-600 transition"
                      >
                        {team.name}
                      </Link>
                    </div>

                    {teamPages.length === 0 ? (
                      <p className="text-sm text-gray-400 px-4 py-3">No OKRs for {currentYear}</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
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
                              className="flex items-center px-4 py-2.5 hover:bg-gray-50 transition gap-4"
                            >
                              <span className="text-sm text-gray-600 w-24">{periodLabel(period)}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pg.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {pg.status}
                              </span>
                              <span className="text-sm text-gray-500">{objs.length} objective{objs.length !== 1 ? 's' : ''}</span>
                              <div className="ml-auto">
                                <ScoreBadge score={score} />
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
