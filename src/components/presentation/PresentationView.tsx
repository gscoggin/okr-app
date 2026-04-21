'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { IOKRPage, IObjective, IKeyResult } from '@/types';
import { presentationScoreBg, computePageScore, periodLabel } from '@/types';
import { RingGauge } from '@/components/ui/RingGauge';

function ScoreChip({ score }: { score: number | undefined }) {
  const cls = presentationScoreBg(score);
  const label = score !== undefined && score !== null ? score.toFixed(2) : '—';
  return (
    <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1 rounded-full text-sm font-bold tabular-nums ${cls}`}>
      {label}
    </span>
  );
}

function KRRow({ kr }: { kr: IKeyResult }) {
  return (
    <div className="py-4 px-5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug flex-1">{kr.title}</p>
        <RingGauge score={kr.score ?? null} size={40} />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {kr.metric && (
          <span>
            <span className="font-medium text-gray-600 dark:text-gray-300">Metric:</span> {kr.metric}
          </span>
        )}
        {kr.currentValue !== undefined && kr.targetValue !== undefined && (
          <span>
            <span className="font-medium text-gray-600 dark:text-gray-300">Progress:</span>{' '}
            {kr.currentValue} → {kr.targetValue}
          </span>
        )}
      </div>

      {kr.owners.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {kr.owners.map((o, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium"
            >
              <span className="w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center text-[10px] font-bold">
                {o.displayName.charAt(0).toUpperCase()}
              </span>
              {o.displayName}
            </span>
          ))}
        </div>
      )}

      {kr.comments && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed">{kr.comments}</p>
      )}
    </div>
  );
}

function ObjectiveBlock({ objective }: { objective: IObjective }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
      {/* Objective header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
      >
        <span
          className={`shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden
        >
          ▾
        </span>

        <span className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
          {objective.title}
        </span>

        <RingGauge score={objective.score ?? null} size={52} />
      </button>

      {/* Owners row */}
      {open && objective.owners.length > 0 && (
        <div className="px-5 pb-2 flex flex-wrap gap-1.5">
          {objective.owners.map((o, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full font-medium"
            >
              <span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center text-[10px] font-bold">
                {o.displayName.charAt(0).toUpperCase()}
              </span>
              {o.displayName}
            </span>
          ))}
        </div>
      )}

      {/* Objective comments */}
      {open && objective.comments && (
        <p className="px-5 pb-3 text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed">{objective.comments}</p>
      )}

      {/* KRs */}
      {open && objective.keyResults.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          {objective.keyResults.map((kr) => (
            <KRRow key={kr._id} kr={kr} />
          ))}
        </div>
      )}

      {open && objective.keyResults.length === 0 && (
        <p className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">No key results.</p>
      )}
    </div>
  );
}

interface PresentationViewProps {
  page: IOKRPage;
  teamName: string;
  teamIconUrl?: string;
  editHref?: string; // present if viewer has edit rights
}

export function PresentationView({ page, teamName, teamIconUrl, editHref }: PresentationViewProps) {
  const pageScore = computePageScore(page.objectives);
  const period = periodLabel(page.period);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            {teamIconUrl && (
              <img src={teamIconUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700" />
            )}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{teamName}</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{period}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Overall</span>
          <RingGauge score={pageScore ?? null} size={64} />
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              page.status === 'published'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
            }`}
          >
            {page.status === 'published' ? 'Published' : 'Draft'}
          </span>
          {editHref && (
            <Link
              href={editHref}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Objectives */}
      {page.objectives.length === 0 ? (
        <p className="text-center text-gray-400 py-16 text-sm">No objectives for this period.</p>
      ) : (
        <div className="space-y-4">
          {page.objectives.map((obj) => (
            <ObjectiveBlock key={obj._id} objective={obj} />
          ))}
        </div>
      )}
    </div>
  );
}
