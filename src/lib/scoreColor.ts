const COLOR_STOPS: Array<[number, number, number, number]> = [
  [0.00, 139,   0,   0],
  [0.30, 204,  85,   0],
  [0.50, 234, 179,   8],
  [0.60, 132, 204,  22],
  [0.70,  34, 197,  94],
  [1.00,  22, 101,  52],
];

export function scoreToColor(score: number): string {
  const clamped = Math.max(0, Math.min(1, score));
  let lo = COLOR_STOPS[0];
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (clamped >= COLOR_STOPS[i][0] && clamped <= COLOR_STOPS[i + 1][0]) {
      lo = COLOR_STOPS[i];
      hi = COLOR_STOPS[i + 1];
      break;
    }
  }
  const range = hi[0] - lo[0];
  const t = range === 0 ? 0 : (clamped - lo[0]) / range;
  const r = Math.round(lo[1] + t * (hi[1] - lo[1]));
  const g = Math.round(lo[2] + t * (hi[2] - lo[2]));
  const b = Math.round(lo[3] + t * (hi[3] - lo[3]));
  return `rgb(${r},${g},${b})`;
}

export function formatScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return score.toFixed(1);
}
