'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TimePeriod, Quarter } from '@/types';
import { periodLabel } from '@/types';

interface PeriodNavProps {
  teamId: string;
  current: TimePeriod;
}

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

function periodUrl(teamId: string, period: TimePeriod): string {
  if (period.type === 'annual') return `/teams/${teamId}/${period.year}`;
  return `/teams/${teamId}/${period.year}/${period.quarter!.toLowerCase()}`;
}

export function PeriodNav({ teamId, current }: PeriodNavProps) {
  const router = useRouter();

  const navigate = (period: TimePeriod) => router.push(periodUrl(teamId, period));

  const prev = () => {
    if (current.type === 'annual') {
      navigate({ type: 'annual', year: current.year - 1 });
    } else {
      const qi = QUARTERS.indexOf(current.quarter!);
      if (qi === 0) navigate({ type: 'quarterly', year: current.year - 1, quarter: 'Q4' });
      else navigate({ type: 'quarterly', year: current.year, quarter: QUARTERS[qi - 1] });
    }
  };

  const next = () => {
    if (current.type === 'annual') {
      navigate({ type: 'annual', year: current.year + 1 });
    } else {
      const qi = QUARTERS.indexOf(current.quarter!);
      if (qi === 3) navigate({ type: 'quarterly', year: current.year + 1, quarter: 'Q1' });
      else navigate({ type: 'quarterly', year: current.year, quarter: QUARTERS[qi + 1] });
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={prev}
        className="px-0.5 py-0.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
        aria-label="Previous period"
      >
        ‹
      </button>

      <span className="font-semibold text-gray-800 dark:text-gray-100 min-w-[5.5rem] text-center">
        {periodLabel(current)}
      </span>

      <button
        onClick={next}
        className="px-0.5 py-0.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
        aria-label="Next period"
      >
        ›
      </button>

      {/* On quarterly pages, link back up to the annual page */}
      {current.type === 'quarterly' && (
        <Link
          href={`/teams/${teamId}/${current.year}`}
          className="ml-2 px-2.5 py-1 rounded-full text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          Annual
        </Link>
      )}
    </div>
  );
}
