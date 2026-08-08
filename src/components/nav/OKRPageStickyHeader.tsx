'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { TimePeriod } from '@/types';
import { PeriodNav } from './PeriodNav';

export interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  breadcrumbs: Crumb[];
  teamId: string;
  period?: TimePeriod;
  rightSlot?: ReactNode;
}

export function OKRPageStickyHeader({ breadcrumbs, teamId, period, rightSlot }: Props) {
  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/85 dark:bg-gray-900/85 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-900/70 print:hidden">
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap px-4 sm:px-6 py-2.5">
        <nav className="text-sm text-gray-500 flex items-center gap-2 flex-wrap min-w-0">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              {c.href ? (
                <Link href={c.href} className="hover:text-gray-700 dark:hover:text-gray-300 shrink-0 truncate max-w-[12rem]">
                  {c.label}
                </Link>
              ) : (
                <span className="text-gray-800 dark:text-gray-200 font-medium shrink-0 truncate max-w-[12rem]">
                  {c.label}
                </span>
              )}
              {i < breadcrumbs.length - 1 && <span className="shrink-0 text-gray-400">/</span>}
            </span>
          ))}
        </nav>

        {period && (
          <div className="shrink-0">
            <PeriodNav teamId={teamId} current={period} />
          </div>
        )}

        {rightSlot && (
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
      title="Print or save as PDF"
    >
      <PrinterIcon />
      PDF
    </button>
  );
}

function PrinterIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zM9 9V5a2 2 0 012-2h2a2 2 0 012 2v4" />
    </svg>
  );
}
