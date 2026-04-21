'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { IOrg, ITeam, TeamOKRSummary, TenantBranding } from '@/types';

const QUARTER_ORDER = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

interface SidebarProps {
  orgs: IOrg[];
  teams: ITeam[];
  teamSummaries: TeamOKRSummary[];
  branding?: TenantBranding;
  tenantName?: string;
  isAdmin?: boolean;
}

const SIDEBAR_KEY = 'sidebar-collapsed';

export function Sidebar({ orgs, teams, teamSummaries, branding, tenantName, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read persisted collapsed state after mount to avoid hydration mismatch
  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'true');
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

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

  const workspaceLetter = (tenantName ?? 'W').charAt(0).toUpperCase();
  const isCollapsed = mounted && collapsed;

  // ── Collapsed rail ──────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <nav className="w-10 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-full flex flex-col items-center py-2 gap-2">
        {/* Expand button */}
        <button
          onClick={toggleCollapsed}
          title="Expand sidebar"
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <SidebarExpandIcon />
        </button>

        {/* Workspace logo / initial */}
        <Link href="/" title={tenantName || 'Home'}>
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover" />
          ) : (
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: branding?.primaryColor ?? '#2563eb' }}
            >
              {workspaceLetter}
            </span>
          )}
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom icons */}
        <Link href="/guide" title="Guide" className={`p-1.5 rounded-md transition ${pathname === '/guide' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
          <GuideIcon />
        </Link>
        {isAdmin && (
          <Link href="/admin" title="Admin" className={`p-1.5 rounded-md transition ${pathname === '/admin' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <AdminIcon />
          </Link>
        )}
        {isAdmin && (
          <Link href="/settings" title="Settings" className={`p-1.5 rounded-md transition ${pathname === '/settings' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <SettingsIcon />
          </Link>
        )}
      </nav>
    );
  }

  // ── Expanded sidebar ────────────────────────────────────────────────────────
  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-full flex flex-col">
      {/* Tenant branding header */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
          ) : (
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: branding?.primaryColor ?? '#2563eb' }}
            >
              {workspaceLetter}
            </span>
          )}
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{tenantName || 'Workspace'}</span>
        </Link>
        {/* Collapse button */}
        <button
          onClick={toggleCollapsed}
          title="Collapse sidebar"
          className="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <SidebarCollapseIcon />
        </button>
      </div>

      {/* Main nav — scrollable */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <p className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Organizations
        </p>

        {orgs.length === 0 && (
          <div className="px-2 py-3">
            <p className="text-xs text-gray-400 mb-1">No organizations yet.</p>
            {isAdmin && (
              <Link href="/admin" className="text-xs text-blue-600 hover:underline font-medium">
                Set up in Admin →
              </Link>
            )}
          </div>
        )}

        {orgs.map((org) => (
          <div key={org._id} className="mb-1">
            <div className="flex items-center">
              <button
                onClick={() => toggle(org._id)}
                className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
              >
                <ChevronIcon open={!!expanded[org._id]} small />
              </button>
              <Link
                href={`/orgs/${org._id}`}
                className={`flex-1 px-2 py-1.5 text-sm rounded-md font-medium ${
                  pathname === `/orgs/${org._id}`
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {org.name}
              </Link>
            </div>

            {expanded[org._id] && (
              <div className="ml-4 mt-0.5 space-y-0.5">
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
      </div>

      {/* Bottom nav links */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 py-2 px-2 space-y-0.5">
        <Link
          href="/guide"
          className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md ${
            pathname === '/guide' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <GuideIcon />
          Guide
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md ${
              pathname === '/admin' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <AdminIcon />
            Admin
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/settings"
            className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md ${
              pathname === '/settings' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <SettingsIcon />
            Settings
          </Link>
        )}
      </div>
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
              ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {team.name}
        </Link>
      </div>

      {isTeamOpen && (
        <div className="ml-3 mt-0.5 border-l border-gray-200 dark:border-gray-700 pl-2 space-y-0.5">
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
                        ? 'text-blue-700 dark:text-blue-400 font-medium'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {yearEntry.year}
                  </Link>
                </div>

                {yearOpen && sortedQuarters.length > 0 && (
                  <div className="ml-3 border-l border-gray-200 dark:border-gray-700 pl-2 space-y-0.5">
                    {sortedQuarters.map((q) => {
                      const qPath = `/teams/${team._id}/${yearEntry.year}/${q.toLowerCase()}`;
                      return (
                        <Link
                          key={q}
                          href={qPath}
                          className={`block px-2 py-0.5 text-xs rounded-md ${
                            pathname === qPath
                              ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
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

function SidebarCollapseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M21 19l-7-7 7-7" />
    </svg>
  );
}

function SidebarExpandIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M3 5l7 7-7 7" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94H9.694a1.125 1.125 0 0 1-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
