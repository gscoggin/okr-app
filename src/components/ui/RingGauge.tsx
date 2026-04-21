import { scoreToColor, formatScore } from '@/lib/scoreColor';

const RADIUS = 38;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RingGaugeProps {
  score: number | null;
  /** Projected end-of-period score (0–1). Shows a ghost arc when ahead of pace. */
  trackingTo?: number;
  size?: number;
}

export function RingGauge({ score, trackingTo, size = 64 }: RingGaugeProps) {
  const hasScore = score != null;
  const arcLength = hasScore ? score * CIRCUMFERENCE : 0;
  const color = hasScore ? scoreToColor(score) : undefined;

  // Show the tracking arc only when projection exceeds current score
  const showTracking = trackingTo != null && hasScore && trackingTo > (score ?? 0) + 0.02;
  const trackingArcLength = showTracking ? trackingTo! * CIRCUMFERENCE : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-label={`Score: ${formatScore(score)}${showTracking ? ` (tracking to ${formatScore(trackingTo!)})` : ''}`}
    >
      {/* Track */}
      <circle
        cx="50" cy="50" r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeOpacity={0.12}
      />

      {/* Tracking-to ghost arc (projected pace) */}
      {showTracking && (
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeOpacity={0.25}
          strokeLinecap="round"
          strokeDasharray={`${trackingArcLength} ${CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
        />
      )}

      {/* Score arc */}
      {hasScore && arcLength > 0 && (
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
        />
      )}

      {/* Score label */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="24"
        fontWeight="700"
        fill={hasScore ? color : 'currentColor'}
        fillOpacity={hasScore ? 1 : 0.3}
      >
        {formatScore(score)}
      </text>
    </svg>
  );
}
