import { NextResponse } from 'next/server';
import { rowsToCsv, CSV_HEADERS } from '@/lib/okrCsv';

const CURRENT_YEAR = new Date().getFullYear();

export async function GET() {
  const exampleRows = [
    {
      year: String(CURRENT_YEAR),
      period: 'annual',
      type: 'objective' as const,
      objective_title: 'Ship a world-class onboarding experience',
      kr_title: '',
      metric_type: '',
      metric_label: '',
      start_value: '',
      target_value: '',
      current_value: '',
      confidence: '',
      owner_email: 'owner@yourcompany.com',
    },
    {
      year: String(CURRENT_YEAR),
      period: 'annual',
      type: 'key_result' as const,
      objective_title: '',
      kr_title: 'Reduce time-to-first-value from 14 days to 3 days',
      metric_type: 'number',
      metric_label: 'Days',
      start_value: '14',
      target_value: '3',
      current_value: '10',
      confidence: 'high',
      owner_email: 'owner@yourcompany.com',
    },
    {
      year: String(CURRENT_YEAR),
      period: 'annual',
      type: 'key_result' as const,
      objective_title: '',
      kr_title: 'Increase onboarding completion rate to 85%',
      metric_type: 'percent',
      metric_label: 'Completion rate',
      start_value: '42',
      target_value: '85',
      current_value: '50',
      confidence: 'medium',
      owner_email: 'owner@yourcompany.com',
    },
    {
      year: String(CURRENT_YEAR),
      period: 'annual',
      type: 'objective' as const,
      objective_title: 'Grow monthly active users',
      kr_title: '',
      metric_type: '',
      metric_label: '',
      start_value: '',
      target_value: '',
      current_value: '',
      confidence: '',
      owner_email: 'owner@yourcompany.com',
    },
    {
      year: String(CURRENT_YEAR),
      period: 'annual',
      type: 'key_result' as const,
      objective_title: '',
      kr_title: 'Reach 10,000 MAU by end of year',
      metric_type: 'number',
      metric_label: 'Monthly active users',
      start_value: '3000',
      target_value: '10000',
      current_value: '4500',
      confidence: 'medium',
      owner_email: 'owner@yourcompany.com',
    },
  ];

  const csv = rowsToCsv(exampleRows);
  const notes = [
    '# OKR Import Template',
    '# ---------------------------------------------------------',
    '# INSTRUCTIONS:',
    '#   - period: annual | q1 | q2 | q3 | q4',
    '#   - type: objective | key_result',
    '#   - metric_type: number | percent | currency | average | ratio | milestone',
    '#   - KR rows inherit the most recent objective row above them',
    '#   - owner_email must match an existing user in your workspace',
    '#   - Lines starting with # are ignored on import',
    '# ---------------------------------------------------------',
    '',
    csv,
  ].join('\n');

  return new NextResponse(notes, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="okr-import-template.csv"`,
    },
  });
}
