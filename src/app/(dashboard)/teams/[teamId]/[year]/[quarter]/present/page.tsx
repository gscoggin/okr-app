export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { connectDB } from '@/lib/mongodb';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import { PresentationView } from '@/components/presentation/PresentationView';
import type { IOKRPage, IObjective, IKeyResult, Quarter } from '@/types';

const VALID_QUARTERS: Record<string, Quarter> = {
  q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4',
};

interface Props {
  params: Promise<{ teamId: string; year: string; quarter: string }>;
}

export default async function QuarterlyPresentPage({ params }: Props) {
  const { teamId, year: yearSlug, quarter: quarterSlug } = await params;

  const year = parseInt(yearSlug, 10);
  if (isNaN(year) || yearSlug.length !== 4) notFound();

  const quarter = VALID_QUARTERS[quarterSlug.toLowerCase()];
  if (!quarter) notFound();

  await connectDB();

  const team = await Team.findById(teamId).lean();
  if (!team) notFound();

  const pageDoc = await OKRPage.findOne({
    teamId,
    'period.type': 'quarterly',
    'period.year': year,
    'period.quarter': quarter,
  }).lean();

  if (!pageDoc) notFound();

  const objectives = await Objective.find({ okrPageId: pageDoc._id }).sort({ sortOrder: 1 }).lean();
  const objectiveIds = objectives.map((o) => o._id);
  const keyResults = await KeyResult.find({ objectiveId: { $in: objectiveIds } }).sort({ sortOrder: 1 }).lean();

  const krsByObjective: Record<string, IKeyResult[]> = {};
  for (const kr of keyResults) {
    const key = kr.objectiveId.toString();
    if (!krsByObjective[key]) krsByObjective[key] = [];
    krsByObjective[key].push({
      _id: kr._id.toString(),
      objectiveId: key,
      title: kr.title,
      owners: kr.owners ?? [],
      metric: kr.metric,
      startValue: kr.startValue,
      targetValue: kr.targetValue,
      currentValue: kr.currentValue,
      confidence: kr.confidence,
      comments: kr.comments,
      score: kr.score,
      status: kr.status,
      sortOrder: kr.sortOrder,
      createdAt: kr.createdAt.toISOString(),
      updatedAt: kr.updatedAt.toISOString(),
    });
  }

  const serializedObjectives: IObjective[] = objectives.map((o) => ({
    _id: o._id.toString(),
    okrPageId: pageDoc._id.toString(),
    title: o.title,
    owners: o.owners ?? [],
    priority: o.priority,
    comments: o.comments,
    score: o.score,
    parentObjectiveId: o.parentObjectiveId?.toString(),
    sortOrder: o.sortOrder ?? 0,
    status: o.status ?? 'draft',
    keyResults: krsByObjective[o._id.toString()] ?? [],
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

  const page: IOKRPage = {
    _id: pageDoc._id.toString(),
    teamId,
    period: { type: 'quarterly', year, quarter },
    status: pageDoc.status,
    objectives: serializedObjectives,
    parentOKRPageId: pageDoc.parentOKRPageId?.toString(),
    createdAt: pageDoc.createdAt.toISOString(),
    updatedAt: pageDoc.updatedAt.toISOString(),
  };

  return (
    <PresentationView
      page={page}
      teamName={team.name}
      teamIconUrl={team.iconUrl ?? undefined}
      backHref={`/teams/${teamId}/${year}/${quarterSlug.toLowerCase()}`}
    />
  );
}
