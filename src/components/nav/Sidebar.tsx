'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import type { IOrg, ITeam } from '@/types';

interface SidebarProps {
  orgs: IOrg[];
  teams: ITeam[];
}

export function Sidebar({ orgs, teams }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand orgs that contain the active team
  useEffect(() => {
    const init: Record<string, boolean> = {};
    orgs.forEach((org) => {
      const hasActive = teams
        .filter((t) => t.orgId === org._id)
        .some((t) => pathname.includes(t._id));
      if (hasActive) init[org._id] = true;
    });
    setExpanded(init);
  }, [orgs, teams, pathname]);

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const teamsByOrg = (orgId: string) =>
    teams.filter((t) => t.orgId === orgId && !t.parentTeamId);

  const subTeams = (parentId: string) => teams.filter((t) => t.parentTeamId === parentId);

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 bg-white h-full overflow-y-auto py-4 px-2">
      <p className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Organizations
      </p>

      {orgs.length === 0 && (
        <div className="px-2 py-3">
          <p className="text-xs text-gray-400 mb-1">No organizations yet.</p>
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
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
                  isActive(`/orgs/${org._id}`)
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
                  pathname={pathname}
                  allTeams={teams}
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
  pathname,
  allTeams,
}: {
  team: ITeam;
  subTeams: ITeam[];
  pathname: string;
  allTeams: ITeam[];
}) {
  const [open, setOpen] = useState(pathname.includes(team._id));
  const href = `/teams/${team._id}`;
  const active = pathname.startsWith(href);

  return (
    <div>
      <div className="flex items-center">
        {subTeams.length > 0 && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-0.5 text-gray-400 hover:text-gray-600"
          >
            <ChevronIcon open={open} small />
          </button>
        )}
        <Link
          href={href}
          className={`flex-1 px-2 py-1 text-sm rounded-md truncate ${
            active
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {team.name}
        </Link>
      </div>
      {open && subTeams.length > 0 && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
          {subTeams.map((st) => (
            <TeamNavItem
              key={st._id}
              team={st}
              subTeams={allTeams.filter((t) => t.parentTeamId === st._id)}
              pathname={pathname}
              allTeams={allTeams}
            />
          ))}
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
