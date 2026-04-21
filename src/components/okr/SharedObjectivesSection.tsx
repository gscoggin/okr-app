'use client';

import { useEffect, useState } from 'react';
import { RingGauge } from '@/components/ui/RingGauge';

interface SharedKR {
  _id: string;
  title: string;
  owners: { type: string; id: string; displayName: string }[];
  score?: number;
  metric?: string;
  currentValue?: number;
  targetValue?: number;
  confidence?: string;
}

interface SharedObjective {
  _id: string;
  title: string;
  score?: number;
  comments?: string;
  keyResults: SharedKR[];
  sourceTeamId: string;
  sourceTeamName: string;
  pageStatus: string;
}

interface Props {
  teamId: string;
  year: number;
  quarter?: string;
}

export function SharedObjectivesSection({ teamId, year, quarter }: Props) {
  const [objectives, setObjectives] = useState<SharedObjective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ teamId, year: String(year) });
    if (quarter) params.set('quarter', quarter);
    fetch(`/api/objectives/shared?${params}`)
      .then((r) => r.json())
      .then((j) => setObjectives(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId, year, quarter]);

  if (loading || objectives.length === 0) return null;

  // Group by source team
  const byTeam = objectives.reduce<Record<string, { name: string; objectives: SharedObjective[] }>>(
    (acc, obj) => {
      if (!acc[obj.sourceTeamId]) acc[obj.sourceTeamId] = { name: obj.sourceTeamName, objectives: [] };
      acc[obj.sourceTeamId].objectives.push(obj);
      return acc;
    },
    {}
  );

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Contributing to
        </h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {objectives.length} shared objective{objectives.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-6">
        {Object.entries(byTeam).map(([id, { name, objectives: objs }]) => (
          <div key={id}>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <TeamIcon />
              {name}
            </p>
            <div className="space-y-3">
              {objs.map((obj) => (
                <SharedObjectiveCard key={obj._id} objective={obj} currentTeamId={teamId} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SharedObjectiveCard({ objective, currentTeamId }: { objective: SharedObjective; currentTeamId: string }) {
  const [open, setOpen] = useState(true);

  // KRs this team owns on this objective
  const ourKRs = objective.keyResults.filter((kr) =>
    kr.owners.some((o) => o.type === 'team' && o.id === currentTeamId)
  );
  const otherKRs = objective.keyResults.filter((kr) =>
    !kr.owners.some((o) => o.type === 'team' && o.id === currentTeamId)
  );

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
      >
        <span className={`text-gray-400 dark:text-gray-500 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}>▾</span>
        <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{objective.title}</span>
        <RingGauge score={objective.score ?? null} size={40} />
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {/* Our KRs — highlighted */}
          {ourKRs.length > 0 && (
            <div className="bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 px-4 py-2">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5 uppercase tracking-wide">
                Our commitments
              </p>
              <div className="space-y-1.5">
                {ourKRs.map((kr) => <KRLine key={kr._id} kr={kr} highlight />)}
              </div>
            </div>
          )}

          {/* Other KRs — dimmed context */}
          {otherKRs.length > 0 && (
            <div className="px-4 py-2">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-wide">
                Other key results
              </p>
              <div className="space-y-1.5">
                {otherKRs.map((kr) => <KRLine key={kr._id} kr={kr} />)}
              </div>
            </div>
          )}

          {objective.comments && (
            <p className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400 italic">{objective.comments}</p>
          )}
        </div>
      )}
    </div>
  );
}

function KRLine({ kr, highlight = false }: { kr: SharedKR; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${highlight ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
      <RingGauge score={kr.score ?? null} size={24} />
      <span className="flex-1 leading-snug">{kr.title}</span>
      {kr.metric && (
        <span className="text-gray-400 dark:text-gray-500 shrink-0">
          {kr.currentValue ?? '—'}/{kr.targetValue ?? '—'} {kr.metric}
        </span>
      )}
    </div>
  );
}

function TeamIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-5M9 20H4v-2a4 4 0 015-5m7-4a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
