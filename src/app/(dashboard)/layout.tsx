export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/nav/Topbar';
import { Sidebar } from '@/components/nav/Sidebar';
import { connectDB } from '@/lib/mongodb';
import Org from '@/models/Org';
import Team from '@/models/Team';
import type { IOrg, ITeam } from '@/types';

async function getData(): Promise<{ orgs: IOrg[]; teams: ITeam[] }> {
  try {
    await connectDB();
    const [orgs, teams] = await Promise.all([
      Org.find({}).sort({ name: 1 }).lean(),
      Team.find({}).sort({ name: 1 }).lean(),
    ]);
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
    };
  } catch {
    // DB unavailable — render layout without sidebar data
    return { orgs: [], teams: [] };
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { orgs, teams } = await getData();

  return (
    <div className="flex flex-col h-screen">
      <Topbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar orgs={orgs} teams={teams} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
