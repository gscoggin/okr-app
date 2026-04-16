import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isTeamOwner } from '@/lib/auth';
import OKRPage from '@/models/OKRPage';
import type { PeriodType, Quarter } from '@/types';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const year = searchParams.get('year');
  const type = searchParams.get('type') as PeriodType | null;

  await connectDB();
  const filter: Record<string, unknown> = {};
  if (teamId) filter.teamId = teamId;
  if (year) filter['period.year'] = parseInt(year);
  if (type) filter['period.type'] = type;

  const pages = await OKRPage.find(filter).sort({ 'period.year': -1 }).lean();
  return ok(pages);
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { teamId, periodType, year, quarter, parentOKRPageId } = await req.json();
  if (!teamId || !periodType || !year) return err('teamId, periodType, and year are required');
  if (periodType === 'quarterly' && !quarter) return err('quarter is required for quarterly OKRs');
  if (!isTeamOwner(user, teamId)) return err('Forbidden', 403);

  await connectDB();

  const existing = await OKRPage.findOne({
    teamId,
    'period.type': periodType,
    'period.year': year,
    ...(quarter ? { 'period.quarter': quarter } : {}),
  });
  if (existing) return err('OKR page already exists for this period', 409);

  const page = await OKRPage.create({
    teamId,
    period: { type: periodType as PeriodType, year, quarter: quarter as Quarter | undefined },
    parentOKRPageId,
  });

  return ok(page, 201);
}
