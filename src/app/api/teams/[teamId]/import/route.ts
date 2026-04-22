import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin, isTeamOwner } from '@/lib/auth';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import User from '@/models/User';
import { csvToRows, PERIOD_VALUES, METRIC_TYPE_VALUES } from '@/lib/okrCsv';
import type { MetricType } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { teamId } = await params;
  if (!isAdmin(user) && !isTeamOwner(user, teamId)) return err('Forbidden', 403);

  await connectDB();

  const team = await Team.findById(teamId).lean();
  if (!team) return err('Team not found', 404);
  if (team.tenantId?.toString() !== user.tenantId) return err('Forbidden', 403);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return err('No file uploaded');

  const text = await file.text();
  const rows = csvToRows(text);
  if (rows.length === 0) return err('CSV is empty or has no data rows');

  // Validate all rows have consistent year/period
  const dataRows = rows.filter((r) => !String(r.year).startsWith('#'));
  const years = [...new Set(dataRows.map((r) => r.year))];
  const periods = [...new Set(dataRows.map((r) => r.period.toLowerCase()))];

  if (years.length > 1) return err('All rows must have the same year');
  if (periods.length > 1) return err('All rows must have the same period');

  const year = parseInt(years[0]);
  if (isNaN(year)) return err('Invalid year in CSV');

  const period = periods[0];
  if (!PERIOD_VALUES.includes(period)) {
    return err(`Invalid period "${period}". Must be one of: ${PERIOD_VALUES.join(', ')}`);
  }

  // Build period query
  const periodDoc = period === 'annual'
    ? { type: 'annual' as const, year }
    : { type: 'quarterly' as const, year, quarter: period.toUpperCase() as 'Q1' | 'Q2' | 'Q3' | 'Q4' };

  // Check for existing content
  const existingPage = await OKRPage.findOne({ teamId, period: periodDoc }).lean();
  const existingCount = existingPage
    ? await Objective.countDocuments({ okrPageId: existingPage._id })
    : 0;

  // Parse objectives + KRs from rows
  interface ParsedObjective {
    title: string;
    ownerEmail: string;
    krs: Array<{
      title: string;
      metricType?: MetricType;
      metric?: string;
      startValue?: number;
      targetValue?: number;
      currentValue?: number;
      confidence?: string;
      ownerEmail: string;
    }>;
  }

  const objectives: ParsedObjective[] = [];
  let currentObj: ParsedObjective | null = null;

  for (const row of dataRows) {
    if (row.type === 'objective') {
      if (!row.objective_title.trim()) continue;
      currentObj = { title: row.objective_title.trim(), ownerEmail: row.owner_email.trim(), krs: [] };
      objectives.push(currentObj);
    } else if (row.type === 'key_result') {
      if (!row.kr_title.trim() || !currentObj) continue;
      const mt = row.metric_type.trim().toLowerCase() as MetricType;
      currentObj.krs.push({
        title: row.kr_title.trim(),
        metricType: METRIC_TYPE_VALUES.includes(mt) ? mt : undefined,
        metric: row.metric_label.trim() || undefined,
        startValue: row.start_value !== '' ? parseFloat(row.start_value) : undefined,
        targetValue: row.target_value !== '' ? parseFloat(row.target_value) : undefined,
        currentValue: row.current_value !== '' ? parseFloat(row.current_value) : undefined,
        confidence: ['low', 'medium', 'high'].includes(row.confidence) ? row.confidence : undefined,
        ownerEmail: row.owner_email.trim(),
      });
    }
  }

  if (objectives.length === 0) return err('No valid objectives found in CSV');

  // Resolve owner emails to user refs
  const allEmails = [
    ...new Set([
      ...objectives.map((o) => o.ownerEmail),
      ...objectives.flatMap((o) => o.krs.map((k) => k.ownerEmail)),
    ].filter(Boolean)),
  ];

  const users = await User.find({ email: { $in: allEmails }, tenantId: user.tenantId }).lean();
  const userMap = new Map(users.map((u) => [u.email, u]));

  // Perform the import in a transaction-like sequence
  // 1. Delete existing content if page exists
  if (existingPage) {
    const objIds = (await Objective.find({ okrPageId: existingPage._id }, '_id').lean()).map((o) => o._id);
    await KeyResult.deleteMany({ objectiveId: { $in: objIds } });
    await Objective.deleteMany({ okrPageId: existingPage._id });
  }

  // 2. Create or reuse the OKR page
  const page = existingPage
    ? await OKRPage.findById(existingPage._id).orFail()
    : await OKRPage.create({ teamId, tenantId: user.tenantId, period: periodDoc, status: 'draft' });

  // 3. Create objectives + KRs
  let objSort = 0;
  let totalKRs = 0;

  for (const obj of objectives) {
    const ownerUser = userMap.get(obj.ownerEmail);
    const owners = ownerUser
      ? [{ type: 'user', id: ownerUser._id.toString(), displayName: ownerUser.name }]
      : [];

    const createdObj = await Objective.create({
      okrPageId: page._id,
      title: obj.title,
      owners,
      status: 'draft',
      sortOrder: objSort++,
    });

    let krSort = 0;
    for (const kr of obj.krs) {
      const krOwnerUser = userMap.get(kr.ownerEmail);
      const krOwners = krOwnerUser
        ? [{ type: 'user', id: krOwnerUser._id.toString(), displayName: krOwnerUser.name }]
        : [];

      await KeyResult.create({
        objectiveId: createdObj._id,
        title: kr.title,
        metricType: kr.metricType,
        metric: kr.metric,
        startValue: kr.startValue,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
        confidence: kr.confidence,
        owners: krOwners,
        status: 'draft',
        sortOrder: krSort++,
      });
      totalKRs++;
    }
  }

  return ok({
    overwritten: existingCount > 0,
    objectivesCreated: objectives.length,
    keyResultsCreated: totalKRs,
    pageId: page._id.toString(),
    year,
    period,
  }, 201);
}

// Check if a page exists and has content (used by UI before confirming overwrite)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);

  const { teamId } = await params;
  if (!isAdmin(user) && !isTeamOwner(user, teamId)) return err('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? '');
  const period = (searchParams.get('period') ?? 'annual').toLowerCase();

  if (isNaN(year)) return err('year is required');

  await connectDB();

  const periodDoc = period === 'annual'
    ? { 'period.type': 'annual', 'period.year': year }
    : { 'period.type': 'quarterly', 'period.year': year, 'period.quarter': period.toUpperCase() };

  const page = await OKRPage.findOne({ teamId, ...periodDoc }).lean();
  if (!page) return ok({ exists: false, objectiveCount: 0 });

  const count = await Objective.countDocuments({ okrPageId: page._id });
  return ok({ exists: true, objectiveCount: count });
}
