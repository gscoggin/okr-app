import type { IKeyResult, MetricType } from '@/types';

export interface CsvRow {
  year: string;
  period: string;
  type: 'objective' | 'key_result';
  objective_title: string;
  kr_title: string;
  metric_type: string;
  metric_label: string;
  start_value: string;
  target_value: string;
  current_value: string;
  confidence: string;
  owner_email: string;
}

export const CSV_HEADERS = [
  'year', 'period', 'type', 'objective_title', 'kr_title',
  'metric_type', 'metric_label', 'start_value', 'target_value',
  'current_value', 'confidence', 'owner_email',
];

export const PERIOD_VALUES = ['annual', 'q1', 'q2', 'q3', 'q4'];
export const METRIC_TYPE_VALUES: MetricType[] = ['number', 'percent', 'currency', 'average', 'ratio', 'milestone'];

function escapeCsv(val: string | number | undefined | null): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: CsvRow[]): string {
  const header = CSV_HEADERS.join(',');
  const lines = rows.map((r) =>
    CSV_HEADERS.map((h) => escapeCsv(r[h as keyof CsvRow])).join(',')
  );
  return [header, ...lines].join('\n');
}

export function csvToRows(text: string): CsvRow[] {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? '').trim(); });
    return obj as unknown as CsvRow;
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export function buildOkrRows(
  objectives: Array<{
    title: string;
    owners?: Array<{ type: string; id: string; displayName: string }>;
    keyResults?: Array<{
      title: string;
      metricType?: string;
      metric?: string;
      startValue?: number;
      targetValue?: number;
      currentValue?: number;
      confidence?: string;
      owners?: Array<{ type: string; id: string; displayName: string }>;
    }>;
  }>,
  year: number,
  period: string,
): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const obj of objectives) {
    const ownerEmail = obj.owners?.find((o) => o.type === 'user')?.displayName ?? '';
    rows.push({
      year: String(year),
      period,
      type: 'objective',
      objective_title: obj.title,
      kr_title: '',
      metric_type: '',
      metric_label: '',
      start_value: '',
      target_value: '',
      current_value: '',
      confidence: '',
      owner_email: ownerEmail,
    });
    for (const kr of obj.keyResults ?? []) {
      const krOwner = kr.owners?.find((o) => o.type === 'user')?.displayName ?? '';
      rows.push({
        year: String(year),
        period,
        type: 'key_result',
        objective_title: '',
        kr_title: kr.title,
        metric_type: kr.metricType ?? '',
        metric_label: kr.metric ?? '',
        start_value: kr.startValue != null ? String(kr.startValue) : '',
        target_value: kr.targetValue != null ? String(kr.targetValue) : '',
        current_value: kr.currentValue != null ? String(kr.currentValue) : '',
        confidence: kr.confidence ?? '',
        owner_email: krOwner,
      });
    }
  }
  return rows;
}

export function buildMd(
  teamName: string,
  year: number,
  period: string,
  objectives: Array<{
    title: string;
    score?: number;
    keyResults?: Array<{
      title: string;
      metric?: string;
      startValue?: number;
      targetValue?: number;
      currentValue?: number;
      confidence?: string;
      score?: number;
    }>;
  }>,
): string {
  const lines: string[] = [
    `# ${teamName} OKRs — ${period === 'annual' ? year : `${period.toUpperCase()} ${year}`}`,
    '',
  ];
  for (const obj of objectives) {
    const score = obj.score != null ? ` _(score: ${(obj.score * 100).toFixed(0)}%)_` : '';
    lines.push(`## ${obj.title}${score}`, '');
    for (const kr of obj.keyResults ?? []) {
      const progress = kr.startValue != null && kr.targetValue != null
        ? ` | ${kr.startValue} → ${kr.currentValue ?? '?'} / ${kr.targetValue}`
        : '';
      const conf = kr.confidence ? ` | confidence: ${kr.confidence}` : '';
      lines.push(`- **${kr.title}**${progress}${conf}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
