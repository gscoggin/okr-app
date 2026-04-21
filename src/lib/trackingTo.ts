import type { TimePeriod, Quarter } from '@/types';

const QUARTER_MONTH_START: Record<Quarter, number> = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };

/**
 * Projects what score a team will land at period-end if progress continues at
 * the current pace: `projection = currentScore / fractionOfPeriodElapsed`.
 *
 * Returns undefined if the period hasn't started or score is null.
 * Returns the actual score (clamped) if the period is over.
 */
export function computeTrackingTo(
  score: number | undefined,
  period: TimePeriod
): number | undefined {
  if (score == null) return undefined;

  const now = new Date();
  const { year, type, quarter } = period;

  let start: Date, end: Date;
  if (type === 'annual') {
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
  } else {
    const monthStart = QUARTER_MONTH_START[quarter!];
    start = new Date(year, monthStart, 1);
    end = new Date(year, monthStart + 3, 1);
  }

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = now.getTime() - start.getTime();
  const timeElapsed = Math.max(0, Math.min(1, elapsedMs / totalMs));

  if (timeElapsed <= 0) return undefined;
  if (timeElapsed >= 1) return Math.min(score, 1);

  return Math.min(score / timeElapsed, 1);
}
