'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import type { IOrg, ITeam, TeamOKRSummary } from '@/types';

const QUARTER_ORDER = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

interface SidebarProps {
  orgs: IOrg[];
  teams: ITeam[];
  teamSummaries: TeamOKRSummary[];
}

export function Sidebar({ orgs, teams, teamSummaries }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const summaryByTeam = new Map(teamSummaries.map((s) => [s.teamId, s]));

  // Auto-expand orgs + teams that are on the active path
  useEffect(() => {
    const init: Record<string, boolean> = {};
    orgs.forEach((org) => {
      const hasActive = teams
        .filter((t) => t.orgId === org._id)
        .some((t) => pathname.includes(t._id));
      if (hasActive) init[org._id] = true;
    });
    teams.forEach((t) => {
      if (pathname.includes(t._id)) init[t._id] = true;
    });
    // Auto-expand active year within a team
    teamSummaries.forEach((s) => {
      s.years.forEach((y) => {
        if (pathname.startsWith(`/teams/${s.teamId}/${y.year}`)) {
          init[`${s.teamId}-${y.year}`] = true;
        }
      });
    });
    setExpanded(init);
  }, [orgs, teams, teamSummaries, pathname]);

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const teamsByOrg = (orgId: string) =>
    teams.filter((t) => t.orgId === orgId && !t.parentTeamId);

  const subTeams = (parentId: string) => teams.filter((t) => t.parentTeamId === parentId);

  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 bg-white h-full overflow-y-auto py-4 px-2">
      <p className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Organizations
      </p>

      {orgs.length === 0 && (
        <div className="px-2 py-3">
          <p className="text-xs text-gray-400 mb-1">No organizations yet.</p>
          {user?.role === 'admin' && (
            <Link href="/admin" className="text-xs text-blue-600 hover:underline font-medium">
              Set up in Admin →
            </Link>
          )}
        </div>
      )}

      {orgs.map((org) => (
        <div key={org._id} className="mb-1">
          <button
            onClick={() => toggle(org._id)}
            className="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md font-medium"
          >
            <ChevronIcon open={!!expanded[org._id]} />
            {org.name}
          </button>

          {expanded[org._id] && (
            <div className="ml-4 mt-0.5 space-y-0.5">
              <Link
                href={`/orgs/${org._id}`}
                className={`block px-2 py-1 text-sm rounded-md ${
                  pathname === `/orgs/${org._id}`
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Overview
              </Link>
              {teamsByOrg(org._id).map((team) => (
                <TeamNavItem
                  key={team._id}
                  team={team}
                  subTeams={subTeams(team._id)}
                  allTeams={teams}
                  summary={summaryByTeam.get(team._id)}
                  pathname={pathname}
                  expanded={expanded}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

function TeamNavItem({
  team,
  subTeams,
  allTeams,
  summary,
  pathname,
  expanded,
  onToggle,
}: {
  team: ITeam;
  subTeams: ITeam[];
  allTeams: ITeam[];
  summary: TeamOKRSummary | undefined;
  pathname: string;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const hasSubTeams = subTeams.length > 0;
  const hasYears = (summary?.years.length ?? 0) > 0;
  const isExpandable = hasSubTeams || hasYears;
  const isTeamOpen = !!expanded[team._id];
  const teamActive = pathname.startsWith(`/teams/${team._id}`);

  return (
    <div>
      <div className="flex items-center">
        {isExpandable ? (
          <button
            onClick={() => onToggle(team._id)}
            className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
          >
            <ChevronIcon open={isTeamOpen} small />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <Link
          href={`/teams/${team._id}`}
          className={`flex-1 px-2 py-1 text-sm rounded-md truncate ${
            teamActive && !pathname.match(/\/teams\/[^/]+\/\d{4}/)
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {team.name}
        </Link>
      </div>

      {isTeamOpen && (
        <div className="ml-3 mt-0.5 border-l border-gray-200 pl-2 space-y-0.5">
          {/* OKR year / quarter hierarchy */}
          {summary?.years.map((yearEntry) => {
            const yearKey = `${team._id}-${yearEntry.year}`;
            const yearOpen = !!expanded[yearKey];
            const yearPath = `/teams/${team._id}/${yearEntry.year}`;
            const yearActive = pathname.startsWith(yearPath);
            const sortedQuarters = QUARTER_ORDER.filter((q) =>
              yearEntry.quarters.includes(q)
            );

            return (
              <div key={yearEntry.year}>
                <div className="flex items-center">
                  {sortedQuarters.length > 0 ? (
                    <button
                      onClick={() => onToggle(yearKey)}
                      className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
                    >
                      <ChevronIcon open={yearOpen} small />
                    </button>
                  ) : (
                    <span className="w-5 shrink-0" />
                  )}
                  <Link
                    href={yearPath}
                    className={`flex-1 px-2 py-0.5 text-sm rounded-md truncate ${
                      yearActive
                        ? 'text-blue-700 font-medium'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {yearEntry.year}
                  </Link>
                </div>

                {yearOpen && sortedQuarters.length > 0 && (
                  <div className="ml-3 border-l border-gray-200 pl-2 space-y-0.5">
                    {sortedQuarters.map((q) => {
                      const qPath = `/teams/${team._id}/${yearEntry.year}/${q.toLowerCase()}`;
                      return (
                        <Link
                          key={q}
                          href={qPath}
                          className={`block px-2 py-0.5 text-xs rounded-md ${
                            pathname === qPath
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {q}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Sub-teams */}
          {hasSubTeams && (
            <div className="mt-0.5 space-y-0.5">
              {subTeams.map((st) => (
                <TeamNavItem
                  key={st._id}
                  team={st}
                  subTeams={allTeams.filter((t) => t.parentTeamId === st._id)}
                  allTeams={allTeams}
                  summary={undefined}
                  pathname={pathname}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open, small }: { open: boolean; small?: boolean }) {
  const size = small ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg
      className={`${size} mr-1 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
