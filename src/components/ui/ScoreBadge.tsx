import { scoreBgClass, confidenceBgClass } from '@/types';
import type { ConfidenceLevel } from '@/types';

export function ScoreBadge({ score }: { score: number | undefined }) {
  const label = score === undefined ? '—' : score.toFixed(2);
  return (
    <span
      data-testid="score-badge"
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${scoreBgClass(score)}`}
    >
      {label}
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel | undefined }) {
  const labels: Record<ConfidenceLevel, string> = {
    high: 'High',
    medium: 'Med',
    low: 'Low',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${confidenceBgClass(level)}`}
    >
      {level ? labels[level] : '—'}
    </span>
  );
}
