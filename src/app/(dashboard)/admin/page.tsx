'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { IconUpload } from '@/components/ui/IconUpload';
import type { IOrg, ITeam, IUser } from '@/types';

interface ArchiveItem {
  _id: string;
  type: 'org' | 'team' | 'year';
  name: string;
  archivedAt: string;
  originalId: string;
  metadata: {
    orgId?: string;
    teamId?: string;
    year?: number;
    pageCount?: number;
    autoArchived?: boolean;
  };
  canUnarchive: boolean;
}

const AUTO_ARCHIVE_AGE = 4; // archive years older than this

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [orgs, setOrgs] = useState<IOrg[]>([]);
  const [teams, setTeams] = useState<ITeam[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [activeYears, setActiveYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete confirms
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState('');
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState('');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState('');

  // Archive confirms
  const [confirmArchiveOrg, setConfirmArchiveOrg] = useState('');
  const [confirmArchiveTeam, setConfirmArchiveTeam] = useState('');
  const [confirmArchiveYear, setConfirmArchiveYear] = useState<number | null>(null);
  const [confirmUnarchive, setConfirmUnarchive] = useState('');
  const [archivingId, setArchivingId] = useState(''); // id/year currently being archived

  // Org form
  const [orgName, setOrgName] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgError, setOrgError] = useState('');

  // Team form
  const [teamName, setTeamName] = useState('');
  const [teamOrgId, setTeamOrgId] = useState('');
  const [teamParentId, setTeamParentId] = useState('');
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState('');

  // Member form (standalone)
  const [memberUserId, setMemberUserId] = useState('');
  const [memberTeamId, setMemberTeamId] = useState('');
  const [memberRole, setMemberRole] = useState<'owner' | 'member'>('member');
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Inline member management (per-team expansion in Teams section)
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [inlineTeamId, setInlineTeamId] = useState('');
  const [inlineUserId, setInlineUserId] = useState('');
  const [inlineRole, setInlineRole] = useState<'owner' | 'member'>('member');
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');

  // Danger zone — reset OKR data
  const [resetStep, setResetStep] = useState<'idle' | 'creds' | 'confirm'>('idle');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetWorking, setResetWorking] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetResult, setResetResult] = useState<{ pages: number; objectives: number; keyResults: number } | null>(null);

  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/');
  }, [user, router]);

  const loadArchives = useCallback(async () => {
    const res = await fetch('/api/archives');
    if (res.ok) setArchives((await res.json()).data ?? []);
  }, []);

  const loadYears = useCallback(async () => {
    const res = await fetch('/api/admin/years');
    if (res.ok) setActiveYears((await res.json()).data ?? []);
  }, []);

  useEffect(() => {
    async function load() {
      const [orgsRes, teamsRes, usersRes] = await Promise.all([
        fetch('/api/orgs'),
        fetch('/api/teams'),
        fetch('/api/users'),
      ]);
      if (orgsRes.ok) setOrgs((await orgsRes.json()).data ?? []);
      if (teamsRes.ok) setTeams((await teamsRes.json()).data ?? []);
      if (usersRes.ok) setUsers((await usersRes.json()).data ?? []);
      await Promise.all([loadArchives(), loadYears()]);
      setLoading(false);
    }
    load();
  }, [loadArchives, loadYears]);

  // Auto-archive years older than AUTO_ARCHIVE_AGE
  useEffect(() => {
    if (loading || activeYears.length === 0) return;
    const currentYear = new Date().getFullYear();
    const stale = activeYears.filter((y) => currentYear - y > AUTO_ARCHIVE_AGE);
    if (stale.length === 0) return;

    (async () => {
      for (const year of stale) {
        await fetch('/api/archives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'year', year, auto: true }),
        });
      }
      await Promise.all([loadArchives(), loadYears()]);
    })();
  }, [loading, activeYears, loadArchives, loadYears]);

  // ── Org actions ────────────────────────────────────────────────────────────

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError('');
    setOrgSaving(true);
    const res = await fetch('/api/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName }),
    });
    const json = await res.json();
    if (res.ok) {
      setOrgs((prev) => [...prev, json.data]);
      setOrgName('');
      router.refresh();
    } else {
      setOrgError(json.error ?? 'Failed to create org');
    }
    setOrgSaving(false);
  };

  const deleteOrg = async (orgId: string) => {
    const res = await fetch(`/api/orgs/${orgId}`, { method: 'DELETE' });
    if (res.ok) {
      setOrgs((prev) => prev.filter((o) => o._id !== orgId));
      setTeams((prev) => prev.filter((t) => t.orgId !== orgId));
      setConfirmDeleteOrg('');
      router.refresh();
    }
  };

  const archiveOrg = async (orgId: string) => {
    setArchivingId(orgId);
    const res = await fetch('/api/archives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'org', targetId: orgId }),
    });
    if (res.ok) {
      setOrgs((prev) => prev.filter((o) => o._id !== orgId));
      setTeams((prev) => prev.filter((t) => t.orgId !== orgId));
      setConfirmArchiveOrg('');
      await loadArchives();
      router.refresh();
    }
    setArchivingId('');
  };

  // ── Team actions ────────────────────────────────────────────────────────────

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError('');
    setTeamSaving(true);
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: teamName,
        orgId: teamOrgId,
        ...(teamParentId ? { parentTeamId: teamParentId } : {}),
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setTeams((prev) => [...prev, json.data]);
      setTeamName('');
      setTeamParentId('');
      router.refresh();
    } else {
      setTeamError(json.error ?? 'Failed to create team');
    }
    setTeamSaving(false);
  };

  const deleteTeam = async (teamId: string) => {
    const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
    if (res.ok) {
      setTeams((prev) => prev.filter((t) => t._id !== teamId));
      setConfirmDeleteTeam('');
      router.refresh();
    }
  };

  const archiveTeam = async (teamId: string) => {
    setArchivingId(teamId);
    const res = await fetch('/api/archives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'team', targetId: teamId }),
    });
    if (res.ok) {
      setTeams((prev) => prev.filter((t) => t._id !== teamId));
      setConfirmArchiveTeam('');
      await loadArchives();
      router.refresh();
    }
    setArchivingId('');
  };

  // ── Year archive ────────────────────────────────────────────────────────────

  const archiveYear = async (year: number) => {
    setArchivingId(String(year));
    const res = await fetch('/api/archives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'year', year }),
    });
    if (res.ok) {
      setConfirmArchiveYear(null);
      await Promise.all([loadArchives(), loadYears()]);
    }
    setArchivingId('');
  };

  // ── Unarchive ───────────────────────────────────────────────────────────────

  const unarchive = async (archiveId: string) => {
    setArchivingId(archiveId);
    const res = await fetch(`/api/archives/${archiveId}`, { method: 'DELETE' });
    if (res.ok) {
      setConfirmUnarchive('');
      const [orgsRes, teamsRes] = await Promise.all([
        fetch('/api/orgs'),
        fetch('/api/teams'),
        loadArchives(),
        loadYears(),
      ]);
      if (orgsRes.ok) setOrgs((await orgsRes.json()).data ?? []);
      if (teamsRes.ok) setTeams((await teamsRes.json()).data ?? []);
      router.refresh();
    }
    setArchivingId('');
  };

  // ── Member actions ──────────────────────────────────────────────────────────

  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeams((e) => ({ ...e, [teamId]: !e[teamId] }));
    setInlineUserId('');
    setInlineRole('member');
    setInlineError('');
    setInlineTeamId(teamId);
  };

  const addInlineMember = async (teamId: string) => {
    setInlineError('');
    setInlineSaving(true);
    setInlineTeamId(teamId);
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: inlineUserId, role: inlineRole }),
    });
    const json = await res.json();
    if (res.ok) {
      const teamsRes = await fetch('/api/teams');
      if (teamsRes.ok) setTeams((await teamsRes.json()).data ?? []);
      setInlineUserId('');
      setInlineRole('member');
    } else {
      setInlineError(json.error ?? 'Failed to add member');
    }
    setInlineSaving(false);
  };

  const removeMember = async (teamId: string, userId: string) => {
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const teamsRes = await fetch('/api/teams');
      if (teamsRes.ok) setTeams((await teamsRes.json()).data ?? []);
    }
  };

  // ── User actions ────────────────────────────────────────────────────────────

  const deleteUser = async (userId: string) => {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setConfirmDeleteUser('');
    }
  };

  // ── Reset OKR data ──────────────────────────────────────────────────────────

  const submitReset = async () => {
    setResetError('');
    setResetWorking(true);
    const res = await fetch('/api/admin/reset-okr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail, password: resetPassword }),
    });
    const json = await res.json();
    if (res.ok) {
      setResetResult(json.data.deleted);
      setResetStep('idle');
      setResetEmail('');
      setResetPassword('');
      await Promise.all([loadArchives(), loadYears()]);
      router.refresh();
    } else {
      setResetError(json.error ?? 'Reset failed');
      setResetStep('creds');
    }
    setResetWorking(false);
  };

  const saveOrgIcon = async (orgId: string, dataUrl: string) => {
    const res = await fetch(`/api/orgs/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iconUrl: dataUrl }),
    });
    if (res.ok) setOrgs((prev) => prev.map((o) => o._id === orgId ? { ...o, iconUrl: dataUrl } : o));
    else throw new Error('Failed');
  };

  const saveTeamIcon = async (teamId: string, dataUrl: string) => {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iconUrl: dataUrl }),
    });
    if (res.ok) setTeams((prev) => prev.map((t) => t._id === teamId ? { ...t, iconUrl: dataUrl } : t));
    else throw new Error('Failed');
  };

  if (!user || user.role !== 'admin') return null;

  const teamsInOrg = (orgId: string) => teams.filter((t) => t.orgId === orgId);
  const userById = (id: string) => users.find((u) => u._id === id);
  const currentYear = new Date().getFullYear();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin</h1>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-10">

          {/* ── Orgs ─────────────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Organizations</h2>

            {orgs.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No organizations yet.</p>
            ) : (
              <ul className="mb-4 divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {orgs.map((org) => (
                  <li key={org._id} className="px-4 py-3 bg-white flex items-center gap-3">
                    <IconUpload
                      iconUrl={org.iconUrl}
                      size={36}
                      label={org.name.charAt(0).toUpperCase()}
                      onSave={(url) => saveOrgIcon(org._id, url)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{org.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {teamsInOrg(org._id).length} team{teamsInOrg(org._id).length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {confirmArchiveOrg === org._id ? (
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Archive org + all teams?</span>
                        <button
                          onClick={() => archiveOrg(org._id)}
                          disabled={archivingId === org._id}
                          className="text-amber-600 font-medium hover:text-amber-800 disabled:opacity-50"
                        >
                          {archivingId === org._id ? 'Archiving…' : 'Archive'}
                        </button>
                        <button onClick={() => setConfirmArchiveOrg('')} className="text-gray-400 hover:text-gray-600">Cancel</button>
                      </span>
                    ) : confirmDeleteOrg === org._id ? (
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Delete org + all teams?</span>
                        <button onClick={() => deleteOrg(org._id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                        <button onClick={() => setConfirmDeleteOrg('')} className="text-gray-400 hover:text-gray-600">Cancel</button>
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setConfirmArchiveOrg(org._id); setConfirmDeleteOrg(''); }}
                          className="text-gray-300 hover:text-amber-400 transition"
                          title="Archive org"
                        >
                          <ArchiveIcon />
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteOrg(org._id); setConfirmArchiveOrg(''); }}
                          className="text-gray-300 hover:text-red-400 transition"
                          title="Delete org"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={createOrg} className="flex gap-3">
              <input
                type="text"
                placeholder="New organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" disabled={orgSaving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {orgSaving ? 'Creating…' : 'Create Org'}
              </button>
            </form>
            {orgError && <p className="text-sm text-red-500 mt-2">{orgError}</p>}
          </section>

          {/* ── Teams ────────────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Teams</h2>

            {orgs.length === 0 ? (
              <p className="text-sm text-gray-400">Create an organization first.</p>
            ) : (
              <>
                {orgs.map((org) => {
                  const orgTeams = teamsInOrg(org._id);
                  return (
                    <div key={org._id} className="mb-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{org.name}</p>
                      {orgTeams.length === 0 ? (
                        <p className="text-sm text-gray-400 mb-2 pl-2">No teams yet.</p>
                      ) : (
                        <div className="mb-2 space-y-1">
                          {orgTeams.map((team) => {
                            const parent = teams.find((t) => t._id === team.parentTeamId);
                            const isExpanded = !!expandedTeams[team._id];
                            const nonMembers = users.filter((u) => !team.members.find((m) => m.userId === u._id));
                            return (
                              <div key={team._id} className="border border-gray-200 rounded-xl overflow-hidden">
                                {/* Team header row */}
                                <div className="px-4 py-3 bg-white flex items-center gap-3">
                                  <IconUpload
                                    iconUrl={team.iconUrl}
                                    size={32}
                                    label={team.name.charAt(0).toUpperCase()}
                                    onSave={(url) => saveTeamIcon(team._id, url)}
                                  />
                                  <button
                                    onClick={() => toggleTeamExpand(team._id)}
                                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                                  >
                                    <ChevronIcon open={isExpanded} small />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-800">{team.name}</p>
                                      {parent && <p className="text-xs text-gray-400 mt-0.5">Sub-team of {parent.name}</p>}
                                    </div>
                                    <span className="text-xs text-gray-400 shrink-0">
                                      {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                                    </span>
                                  </button>

                                  {confirmArchiveTeam === team._id ? (
                                    <span className="flex items-center gap-2 text-xs shrink-0">
                                      <span className="text-gray-500">Archive team + OKRs?</span>
                                      <button
                                        onClick={() => archiveTeam(team._id)}
                                        disabled={archivingId === team._id}
                                        className="text-amber-600 font-medium hover:text-amber-800 disabled:opacity-50"
                                      >
                                        {archivingId === team._id ? 'Archiving…' : 'Archive'}
                                      </button>
                                      <button onClick={() => setConfirmArchiveTeam('')} className="text-gray-400 hover:text-gray-600">Cancel</button>
                                    </span>
                                  ) : confirmDeleteTeam === team._id ? (
                                    <span className="flex items-center gap-2 text-xs shrink-0">
                                      <span className="text-gray-500">Delete team + OKRs?</span>
                                      <button onClick={() => deleteTeam(team._id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                                      <button onClick={() => setConfirmDeleteTeam('')} className="text-gray-400 hover:text-gray-600">Cancel</button>
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => { setConfirmArchiveTeam(team._id); setConfirmDeleteTeam(''); }}
                                        className="text-gray-300 hover:text-amber-400 transition"
                                        title="Archive team"
                                      >
                                        <ArchiveIcon />
                                      </button>
                                      <button
                                        onClick={() => { setConfirmDeleteTeam(team._id); setConfirmArchiveTeam(''); }}
                                        className="text-gray-300 hover:text-red-400 transition"
                                        title="Delete team"
                                      >
                                        <TrashIcon />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Expanded: member chips + add row */}
                                {isExpanded && (
                                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                                    {/* Member chips */}
                                    {team.members.length === 0 ? (
                                      <p className="text-xs text-gray-400">No members yet.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {team.members.map((m) => {
                                          const u = userById(m.userId);
                                          return (
                                            <span key={m.userId} className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-white border border-gray-200 rounded-full text-xs">
                                              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium uppercase text-[10px] shrink-0">
                                                {u?.name?.[0] ?? '?'}
                                              </span>
                                              <span className="font-medium text-gray-700">{u?.name ?? m.userId}</span>
                                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${m.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {m.role}
                                              </span>
                                              <button
                                                onClick={() => removeMember(team._id, m.userId)}
                                                className="text-gray-300 hover:text-red-400 transition leading-none ml-0.5"
                                                title="Remove"
                                              >
                                                ×
                                              </button>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Add member row */}
                                    <div className="flex gap-2">
                                      <select
                                        value={inlineTeamId === team._id ? inlineUserId : ''}
                                        onChange={(e) => { setInlineTeamId(team._id); setInlineUserId(e.target.value); }}
                                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      >
                                        <option value="">Add member…</option>
                                        {nonMembers.map((u) => (
                                          <option key={u._id} value={u._id}>{u.name}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={inlineTeamId === team._id ? inlineRole : 'member'}
                                        onChange={(e) => { setInlineTeamId(team._id); setInlineRole(e.target.value as 'owner' | 'member'); }}
                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      >
                                        <option value="member">Member</option>
                                        <option value="owner">Owner</option>
                                      </select>
                                      <button
                                        onClick={() => addInlineMember(team._id)}
                                        disabled={inlineTeamId !== team._id || !inlineUserId || inlineSaving}
                                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
                                      >
                                        {inlineSaving && inlineTeamId === team._id ? '…' : 'Add'}
                                      </button>
                                    </div>
                                    {inlineError && inlineTeamId === team._id && (
                                      <p className="text-xs text-red-500">{inlineError}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <form onSubmit={createTeam} className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <p className="text-sm font-medium text-gray-700">New Team</p>
                  <input
                    type="text"
                    placeholder="Team name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <select
                    value={teamOrgId}
                    onChange={(e) => { setTeamOrgId(e.target.value); setTeamParentId(''); }}
                    required
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select organization…</option>
                    {orgs.map((org) => (
                      <option key={org._id} value={org._id}>{org.name}</option>
                    ))}
                  </select>
                  {teamOrgId && teamsInOrg(teamOrgId).length > 0 && (
                    <select
                      value={teamParentId}
                      onChange={(e) => setTeamParentId(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">No parent (top-level team)</option>
                      {teamsInOrg(teamOrgId).map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                  <button type="submit" disabled={teamSaving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                    {teamSaving ? 'Creating…' : 'Create Team'}
                  </button>
                  {teamError && <p className="text-sm text-red-500">{teamError}</p>}
                </form>
              </>
            )}
          </section>

          {/* ── Users ────────────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Users</h2>

            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
              {users.map((u) => (
                <li key={u._id} className="flex items-center px-4 py-3 bg-white gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold uppercase shrink-0">
                    {u.name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.role}
                  </span>
                  {u._id === user?.userId ? (
                    <span className="text-xs text-gray-300 w-5" title="You">you</span>
                  ) : confirmDeleteUser === u._id ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Delete user?</span>
                      <button onClick={() => deleteUser(u._id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                      <button onClick={() => setConfirmDeleteUser('')} className="text-gray-400 hover:text-gray-600">Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteUser(u._id)} className="text-gray-300 hover:text-red-400 transition" title="Delete user">
                      <TrashIcon />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ── Archive Years ─────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Archive Years</h2>
            <p className="text-xs text-gray-400 mb-4">
              Years older than {AUTO_ARCHIVE_AGE} years are auto-archived when this page loads.
            </p>

            {activeYears.length === 0 ? (
              <p className="text-sm text-gray-400">No active year data found.</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {activeYears.map((year) => {
                  const isStale = currentYear - year > AUTO_ARCHIVE_AGE;
                  return (
                    <li key={year} className="px-4 py-3 bg-white flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{year}</p>
                        {isStale && (
                          <p className="text-xs text-amber-500 mt-0.5">Queued for auto-archive</p>
                        )}
                      </div>
                      {confirmArchiveYear === year ? (
                        <span className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">Archive all {year} OKR data?</span>
                          <button
                            onClick={() => archiveYear(year)}
                            disabled={archivingId === String(year)}
                            className="text-amber-600 font-medium hover:text-amber-800 disabled:opacity-50"
                          >
                            {archivingId === String(year) ? 'Archiving…' : 'Archive'}
                          </button>
                          <button onClick={() => setConfirmArchiveYear(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmArchiveYear(year)}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-600 transition border border-gray-200 hover:border-amber-300 rounded-lg px-2.5 py-1"
                        >
                          <ArchiveIcon />
                          Archive
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Archived Items ────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Archived Items</h2>
            <p className="text-xs text-gray-400 mb-4">
              Year archives can be restored within {AUTO_ARCHIVE_AGE} years. Limited to 20 year archives total.
            </p>

            {archives.length === 0 ? (
              <p className="text-sm text-gray-400">No archives yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {archives.map((a) => (
                  <li key={a._id} className="px-4 py-3 bg-white flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800">{a.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          a.type === 'year' ? 'bg-purple-100 text-purple-600' :
                          a.type === 'org'  ? 'bg-blue-100 text-blue-600' :
                                              'bg-gray-100 text-gray-500'
                        }`}>{a.type}</span>
                        {a.metadata?.autoArchived && (
                          <span className="text-xs text-gray-400">auto</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.metadata?.pageCount != null ? `${a.metadata.pageCount} page${a.metadata.pageCount !== 1 ? 's' : ''}` : ''}
                        {' · '}
                        {new Date(a.archivedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {confirmUnarchive === a._id ? (
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Restore to active?</span>
                        <button
                          onClick={() => unarchive(a._id)}
                          disabled={archivingId === a._id}
                          className="text-blue-600 font-medium hover:text-blue-800 disabled:opacity-50"
                        >
                          {archivingId === a._id ? 'Restoring…' : 'Restore'}
                        </button>
                        <button onClick={() => setConfirmUnarchive('')} className="text-gray-400 hover:text-gray-600">Cancel</button>
                      </span>
                    ) : a.canUnarchive ? (
                      <button
                        onClick={() => setConfirmUnarchive(a._id)}
                        className="text-xs text-gray-400 hover:text-blue-600 transition border border-gray-200 hover:border-blue-300 rounded-lg px-2.5 py-1"
                      >
                        Restore
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300" title={`Outside the ${AUTO_ARCHIVE_AGE}-year restore window`}>
                        Expired
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Danger Zone ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-red-600 mb-1">Danger Zone</h2>
            <p className="text-xs text-gray-400 mb-4">
              These actions are permanent and cannot be undone.
            </p>

            <div className="border border-red-200 rounded-xl p-4 bg-red-50">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">Delete All OKR Data</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Permanently deletes every OKR page, objective, and key result. Archives are not affected.
                  </p>
                </div>
                {resetStep === 'idle' && !resetResult && (
                  <button
                    onClick={() => { setResetStep('creds'); setResetError(''); }}
                    className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition"
                  >
                    Delete all…
                  </button>
                )}
              </div>

              {resetResult && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
                  Done. Deleted {resetResult.pages} page{resetResult.pages !== 1 ? 's' : ''},{' '}
                  {resetResult.objectives} objective{resetResult.objectives !== 1 ? 's' : ''},{' '}
                  and {resetResult.keyResults} key result{resetResult.keyResults !== 1 ? 's' : ''}.
                </p>
              )}

              {resetStep === 'creds' && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs font-medium text-gray-600">Confirm your identity to continue:</p>
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                    autoComplete="email"
                  />
                  <input
                    type="password"
                    placeholder="Your password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                    autoComplete="current-password"
                  />
                  {resetError && <p className="text-xs text-red-600">{resetError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setResetStep('confirm')}
                      disabled={!resetEmail || !resetPassword}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40 transition"
                    >
                      Continue
                    </button>
                    <button
                      onClick={() => { setResetStep('idle'); setResetEmail(''); setResetPassword(''); setResetError(''); }}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {resetStep === 'confirm' && (
                <div className="mt-3 space-y-3 border border-red-300 rounded-lg p-3 bg-white">
                  <p className="text-sm font-semibold text-red-700">Are you absolutely sure?</p>
                  <p className="text-xs text-gray-600">
                    This will permanently erase <strong>all OKR pages, objectives, and key results</strong> across every team and org. This action cannot be undone.
                  </p>
                  {resetError && <p className="text-xs text-red-600">{resetError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={submitReset}
                      disabled={resetWorking}
                      className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      {resetWorking ? 'Deleting…' : 'Yes, delete everything'}
                    </button>
                    <button
                      onClick={() => { setResetStep('idle'); setResetEmail(''); setResetPassword(''); setResetError(''); }}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open, small }: { open: boolean; small?: boolean }) {
  const size = small ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg
      className={`${size} mr-1 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}
