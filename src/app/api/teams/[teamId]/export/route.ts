import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiUtils';
import { isAdmin, isTeamOwner } from '@/lib/auth';
import { err } from '@/lib/apiUtils';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import { buildOkrRows, buildMd, rowsToCsv } from '@/lib/okrCsv';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { teamId } = await params;

  if (!isAdmin(user) && !isTeamOwner(user, teamId)) {
    return err('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? '');
  const period = searchParams.get('period') ?? 'annual';
  const format = searchParams.get('format') ?? 'csv';

  if (isNaN(year)) return err('year is required');

  await connectDB();

  const team = await Team.findById(teamId).lean();
  if (!team) return err('Team not found', 404);
  if (team.tenantId?.toString() !== user.tenantId) return err('Forbidden', 403);

  const periodQuery = period === 'annual'
    ? { 'period.type': 'annual', 'period.year': year }
    : { 'period.type': 'quarterly', 'period.year': year, 'period.quarter': period.toUpperCase() };

  const page = await OKRPage.findOne({ teamId, ...periodQuery }).lean();
  if (!page) return err('No OKR page found for that period', 404);

  const objectives = await Objective.find({ okrPageId: page._id }).sort({ sortOrder: 1 }).lean();
  const objectiveIds = objectives.map((o) => o._id);
  const allKRs = await KeyResult.find({ objectiveId: { $in: objectiveIds } }).sort({ sortOrder: 1 }).lean();

  const krsByObjective = new Map<string, typeof allKRs>();
  for (const kr of allKRs) {
    const key = kr.objectiveId.toString();
    if (!krsByObjective.has(key)) krsByObjective.set(key, []);
    krsByObjective.get(key)!.push(kr);
  }

  const objectivesWithKRs = objectives.map((obj) => ({
    ...obj,
    owners: obj.owners as Array<{ type: string; id: string; displayName: string }>,
    keyResults: (krsByObjective.get(obj._id.toString()) ?? []).map((kr) => ({
      ...kr,
      owners: kr.owners as Array<{ type: string; id: string; displayName: string }>,
    })),
  }));

  const periodLabel = period === 'annual' ? 'annual' : period.toLowerCase();
  const filename = `${team.name.toLowerCase().replace(/\s+/g, '-')}-okrs-${year}-${periodLabel}`;

  if (format === 'md') {
    const md = buildMd(team.name, year, periodLabel, objectivesWithKRs);
    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${filename}.md"`,
      },
    });
  }

  const rows = buildOkrRows(objectivesWithKRs, year, periodLabel);
  const csv = rowsToCsv(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
