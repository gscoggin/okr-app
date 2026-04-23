export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/nav/Topbar';
import { Sidebar } from '@/components/nav/Sidebar';
import { DemoProvider } from '@/components/demo/DemoContext';
import { connectDB } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import Org from '@/models/Org';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Tenant from '@/models/Tenant';
import type { IOrg, ITeam, TeamOKRSummary, Quarter, TenantBranding } from '@/types';

async function getData(tenantId: string): Promise<{
  orgs: IOrg[];
  teams: ITeam[];
  teamSummaries: TeamOKRSummary[];
  branding: TenantBranding;
  tenantName: string;
}> {
  try {
    await connectDB();
    const [orgs, teams, pages, tenant] = await Promise.all([
      Org.find({ tenantId }).sort({ name: 1 }).lean(),
      Team.find({ tenantId }).sort({ name: 1 }).lean(),
      OKRPage.find({ tenantId }).select('teamId period').lean(),
      Tenant.findById(tenantId).lean(),
    ]);

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
    for (const s of summaryMap.values()) {
      s.years.sort((a, b) => b.year - a.year);
    }

    return {
      orgs: orgs.map((o) => ({
        _id: o._id.toString(),
        name: o.name,
        slug: o.slug,
        teams: o.teams.map((t) => t.toString()),
        iconUrl: o.iconUrl,
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
        iconUrl: t.iconUrl,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      teamSummaries: Array.from(summaryMap.values()),
      branding: tenant?.branding ?? {},
      tenantName: tenant?.name ?? '',
    };
  } catch {
    return { orgs: [], teams: [], teamSummaries: [], branding: {}, tenantName: '' };
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const tenantId = user?.tenantId ?? '';
  const isAdmin = user ? ['super_admin', 'tenant_owner', 'admin'].includes(user.role) : false;

  const { orgs, teams, teamSummaries, branding, tenantName } = await getData(tenantId);

  return (
    <DemoProvider>
      <div className="flex flex-col h-screen">
        <Topbar />
        <div className="flex flex-1 min-h-0">
          <Sidebar
            orgs={orgs}
            teams={teams}
            teamSummaries={teamSummaries}
            branding={branding}
            tenantName={tenantName}
            isAdmin={isAdmin}
          />
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">{children}</main>
        </div>
      </div>
    </DemoProvider>
  );
}
