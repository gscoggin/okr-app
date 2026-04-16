'use client';

import { useRouter } from 'next/navigation';
import type { TimePeriod, Quarter } from '@/types';
import { periodLabel } from '@/types';

interface PeriodNavProps {
  teamId: string;
  current: TimePeriod;
}

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export function PeriodNav({ teamId, current }: PeriodNavProps) {
  const router = useRouter();

  const navigate = (period: TimePeriod) => {
    const q = period.quarter ? `-${period.quarter.toLowerCase()}` : '';
    router.push(`/teams/${teamId}/${period.year}${q}`);
  };

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

  const switchType = () => {
    if (current.type === 'annual') {
      const currentQ = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}` as Quarter;
      navigate({ type: 'quarterly', year: current.year, quarter: currentQ });
    } else {
      navigate({ type: 'annual', year: current.year });
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={prev}
        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition"
        aria-label="Previous period"
      >
        ←
      </button>

      <span className="font-semibold text-gray-800 min-w-[6rem] text-center">
        {periodLabel(current)}
      </span>

      <button
        onClick={next}
        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition"
        aria-label="Next period"
      >
        →
      </button>

      <button
        onClick={switchType}
        className="ml-2 px-2.5 py-1 rounded-full text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
      >
        {current.type === 'annual' ? 'Quarterly' : 'Annual'}
      </button>
    </div>
  );
}
