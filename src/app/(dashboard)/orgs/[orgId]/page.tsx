export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import { RingGauge } from '@/components/ui/RingGauge';
import { computePageScore, periodLabel } from '@/types';
import { serializeObjective } from '@/lib/serializeOKR';
import type { IObjective } from '@/types';

interface Props {
  params: Promise<{ orgId: string }>;
}

export default async function OrgPage({ params }: Props) {
  const { orgId } = await params;
  await connectDB();

  const org = await Org.findById(orgId).lean();
  if (!org) notFound();

  const currentYear = new Date().getFullYear();
  const teams = await Team.find({ orgId }).sort({ name: 1 }).lean();
  const teamIds = teams.map((t) => t._id);

  const pages = await OKRPage.find({
    teamId: { $in: teamIds },
    'period.year': currentYear,
  }).lean();

  const pageIds = pages.map((p) => p._id);
  const objectives = await Objective.find({ okrPageId: { $in: pageIds } }).lean();

  const objsByPage: Record<string, IObjective[]> = {};
  for (const obj of objectives) {
    const key = obj.okrPageId.toString();
    if (!objsByPage[key]) objsByPage[key] = [];
    objsByPage[key].push(serializeObjective(obj, []));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{org.name}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{currentYear} — OKR Overview</p>
      </div>

      <div className="space-y-4">
        {teams.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-12">No teams in this org.</p>
        )}

        {teams.map((team) => {
          const teamPages = pages.filter((p) => p.teamId.toString() === team._id.toString());

          return (
            <div key={team._id.toString()} className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <Link
                  href={`/teams/${team._id}`}
                  className="font-semibold text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  {team.name}
                </Link>
                <Link
                  href={`/teams/${team._id}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View OKRs →
                </Link>
              </div>

              {teamPages.length === 0 ? (
                <p className="text-sm text-gray-400 px-5 py-3">No OKR pages for {currentYear}.</p>
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
                        className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-sm"
                      >
                        <span className="text-gray-600 dark:text-gray-400 w-20">{periodLabel(period)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pg.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}`}>
                          {pg.status}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">{objs.length} objective{objs.length !== 1 ? 's' : ''}</span>
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
    </div>
  );
}
