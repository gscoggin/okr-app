export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/nav/Topbar';
import { Sidebar } from '@/components/nav/Sidebar';
import { connectDB } from '@/lib/mongodb';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import type { IOrg, ITeam, TeamOKRSummary, Quarter } from '@/types';

async function getData(): Promise<{ orgs: IOrg[]; teams: ITeam[]; teamSummaries: TeamOKRSummary[] }> {
  try {
    await connectDB();
    const [orgs, teams, pages] = await Promise.all([
      Org.find({}).sort({ name: 1 }).lean(),
      Team.find({}).sort({ name: 1 }).lean(),
      OKRPage.find({}).select('teamId period').lean(),
    ]);

    // Build per-team OKR summaries for sidebar navigation
    const summaryMap = new Map<string, TeamOKRSummary>();
    for (const page of pages) {
      const teamId = page.teamId.toString();
      if (!summaryMap.has(teamId)) summaryMap.set(teamId, { teamId, years: [] });
      const summary = summaryMap.get(teamId)!;
      const { year, type, quarter } = page.period;
      let yearEntry = summary.years.find((y) => y.year === year);
      if (!yearEntry) {
        yearEntry = { year, annualPageId: null, quarters: [] };
        summary.years.push(yearEntry);
      }
      if (type === 'annual') {
        yearEntry.annualPageId = page._id.toString();
      } else if (quarter) {
        yearEntry.quarters.push(quarter as Quarter);
      }
    }
    // Sort years descending within each summary
    for (const s of summaryMap.values()) {
      s.years.sort((a, b) => b.year - a.year);
    }

    return {
      orgs: orgs.map((o) => ({
        _id: o._id.toString(),
        name: o.name,
        slug: o.slug,
        teams: o.teams.map((t) => t.toString()),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      teams: teams.map((t) => ({
        _id: t._id.toString(),
        name: t.name,
        slug: t.slug,
        orgId: t.orgId.toString(),
        parentTeamId: t.parentTeamId?.toString(),
        subTeams: t.subTeams.map((s) => s.toString()),
        members: t.members.map((m) => ({ userId: m.userId.toString(), role: m.role })),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      teamSummaries: Array.from(summaryMap.values()),
    };
  } catch {
    return { orgs: [], teams: [], teamSummaries: [] };
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { orgs, teams, teamSummaries } = await getData();

  return (
    <div className="flex flex-col h-screen">
      <Topbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar orgs={orgs} teams={teams} teamSummaries={teamSummaries} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
