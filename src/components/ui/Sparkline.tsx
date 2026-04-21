'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import type { ScoreSnapshot } from '@/types';
import { scoreToColor } from '@/lib/scoreColor';

interface SparklineProps {
  history: ScoreSnapshot[];
  currentScore?: number;
  width?: number;
  height?: number;
}

export function Sparkline({ history, currentScore, width = 80, height = 32 }: SparklineProps) {
  if (history.length < 2) return null;

  const data = history
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((s) => ({ score: Math.round(s.score * 100) }));

  const color = currentScore != null ? scoreToColor(currentScore) : '#6b7280';

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis domain={[0, 100]} hide />
        <Tooltip
          formatter={(v) => [`${v}%`, 'Score']}
          contentStyle={{ fontSize: 11, padding: '2px 6px' }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
