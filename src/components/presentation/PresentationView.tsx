'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { IOKRPage, IObjective, IKeyResult } from '@/types';
import { computePageScore } from '@/types';
import { RingGauge } from '@/components/ui/RingGauge';
import { OKRPageStickyHeader, PrintButton, type Crumb } from '@/components/nav/OKRPageStickyHeader';
import { ImportExportPanel } from '@/components/okr/ImportExportPanel';
import { useDemo } from '@/components/demo/DemoContext';

// ── Small owner avatar cluster ────────────────────────────────────────────────

function OwnerAvatars({
  owners,
  purple = false,
}: {
  owners: Array<{ id?: string; displayName: string }>;
  purple?: boolean;
}) {
  if (owners.length === 0) return null;
  const cls = purple
    ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
    : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300';
  return (
    <div className="flex items-center gap-0.5 justify-center flex-wrap mt-1.5">
      {owners.slice(0, 3).map((o, i) => (
        <span
          key={i}
          title={o.displayName}
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold uppercase ring-1 ring-white dark:ring-gray-800 ${cls}`}
        >
          {o.displayName.charAt(0)}
        </span>
      ))}
      {owners.length > 3 && (
        <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-0.5">+{owners.length - 3}</span>
      )}
    </div>
  );
}

// ── Progress bar: start → current → target ────────────────────────────────────

function ProgressBar({
  start,
  current,
  target,
  metricType,
}: {
  start: number;
  current: number;
  target: number;
  metricType?: string;
}) {
  const range = target - start;
  if (range === 0) return null;
  const pct = Math.max(0, Math.min(100, ((current - start) / range) * 100));

  const fmt = (v: number) => {
    if (metricType === 'percent') return `${v}%`;
    if (metricType === 'currency') return `$${v.toLocaleString()}`;
    if (metricType === 'ratio') return `${v}×`;
    return v.toLocaleString();
  };

  return (
    <div className="mt-2.5 flex items-center gap-2">
      <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">{fmt(start)}</span>
      <div className="relative flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-blue-400 dark:bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium shrink-0">{fmt(current)}</span>
      <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">/ {fmt(target)}</span>
    </div>
  );
}

// ── Key Result row ────────────────────────────────────────────────────────────

function KRRow({ kr, index }: { kr: IKeyResult; index: number }) {
  const accentBorder =
    kr.confidence === 'high'   ? 'border-l-[3px] border-l-emerald-400' :
    kr.confidence === 'medium' ? 'border-l-[3px] border-l-amber-400' :
    kr.confidence === 'low'    ? 'border-l-[3px] border-l-red-400' : '';

  return (
    <div className={`py-4 px-4 sm:px-5 border-b border-gray-100 dark:border-gray-700/60 last:border-0 ${accentBorder}`}>
      <div className="flex items-start gap-3 sm:gap-4">

        {/* Left: label + title + metadata */}
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center text-[9px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/80 px-1.5 py-0.5 rounded mb-2">
            Key Result <span className="ml-1 opacity-60">{index + 1}</span>
          </span>

          <p className="text-[19px] font-medium text-gray-800 dark:text-gray-200 leading-snug">{kr.title}</p>

          {(kr.metric || kr.confidence) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {kr.metric && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">Metric:</span>{' '}
                  {kr.metric}
                </span>
              )}
              {kr.confidence && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    kr.confidence === 'high'
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : kr.confidence === 'medium'
                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}
                >
                  {kr.confidence.charAt(0).toUpperCase() + kr.confidence.slice(1)} confidence
                </span>
              )}
            </div>
          )}

          {kr.startValue != null && kr.currentValue != null && kr.targetValue != null && (
            <ProgressBar
              start={kr.startValue}
              current={kr.currentValue}
              target={kr.targetValue}
              metricType={kr.metricType}
            />
          )}

          {kr.comments && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic leading-relaxed">{kr.comments}</p>
          )}
        </div>

        {/* Right: ring + owner avatars */}
        <div className="shrink-0 flex flex-col items-center min-w-[3rem]">
          <RingGauge score={kr.score ?? null} size={44} />
          <OwnerAvatars owners={kr.owners} />
        </div>
      </div>
    </div>
  );
}

// ── Objective block ───────────────────────────────────────────────────────────

function ObjectiveBlock({ objective, index }: { objective: IObjective; index: number }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">

      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left hover:bg-gray-50/70 dark:hover:bg-gray-700/40 transition-colors"
      >
        <div className="px-5 pt-4 pb-0.5 flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-widest uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
            Objective <span className="ml-1 opacity-60">{index + 1}</span>
          </span>
          <span
            className={`ml-auto text-gray-400 dark:text-gray-500 text-sm transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          >
            ▾
          </span>
        </div>

        <div className="px-5 pb-4 pt-2 flex items-start gap-4">
          <span className="flex-1 text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug text-left">
            {objective.title || <span className="text-gray-400 italic">Untitled objective</span>}
          </span>
          <div className="shrink-0 flex flex-col items-center min-w-[3.5rem]">
            <RingGauge score={objective.score ?? null} size={56} />
            <OwnerAvatars owners={objective.owners} purple />
          </div>
        </div>
      </button>

      {/* Optional comments */}
      {open && objective.comments && (
        <div className="px-5 pb-3 text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed border-t border-gray-50 dark:border-gray-700/50 pt-2">
          {objective.comments}
        </div>
      )}

      {/* KR section */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {objective.keyResults.length === 0 ? (
            <p className="px-5 py-4 text-xs text-gray-400 dark:text-gray-500 italic">No key results yet.</p>
          ) : (
            <div className="bg-gray-50/60 dark:bg-gray-900/30">
              {objective.keyResults.map((kr, i) => (
                <KRRow key={kr._id} kr={kr} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PresentationViewProps {
  page: IOKRPage;
  teamName: string;
  teamIconUrl?: string;
  editHref?: string;
  teamId: string;
  breadcrumbs: Crumb[];
  importPeriod: string;
  year: number;
  canImportExport: boolean;
}

export function PresentationView({
  page,
  teamName,
  teamIconUrl,
  editHref,
  teamId,
  breadcrumbs,
  importPeriod,
  year,
  canImportExport,
}: PresentationViewProps) {
  const pageScore = computePageScore(page.objectives);
  const { isDemo, triggerNudge } = useDemo();

  const rightSlot = (
    <>
      <PrintButton />
      {canImportExport && (
        <ImportExportPanel teamId={teamId} year={year} period={importPeriod} teamName={teamName} />
      )}
      {editHref && (isDemo ? (
        <button
          onClick={triggerNudge}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          Edit
        </button>
      ) : (
        <Link
          href={editHref}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition inline-block"
        >
          Edit
        </Link>
      ))}
    </>
  );

  return (
    <>
      <OKRPageStickyHeader
        breadcrumbs={breadcrumbs}
        teamId={teamId}
        period={page.period}
        rightSlot={rightSlot}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">

          {/* Left: team identity */}
          <div className="flex items-start gap-3 min-w-0">
            {teamIconUrl && (
              <img
                src={teamIconUrl}
                alt=""
                className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shrink-0 mt-0.5"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">{teamName}</h1>
            </div>
          </div>

          {/* Right: status + overall ring */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="sm:text-right space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Overall</p>
              <span
                className={`inline-block text-xs px-2.5 py-1 rounded-full font-semibold ${
                  page.status === 'published'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                }`}
              >
                {page.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
            <RingGauge score={pageScore ?? null} size={64} />
          </div>
        </div>

        {/* ── Objectives list ───────────────────────────────────────────────── */}
        {page.objectives.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 py-16 text-sm">No objectives for this period.</p>
        ) : (
          <div className="space-y-5">
            {page.objectives.map((obj, i) => (
              <ObjectiveBlock key={obj._id} objective={obj} index={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
