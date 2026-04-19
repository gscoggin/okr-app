export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import { getCurrentUser, canEditTeamOKR } from '@/lib/auth';
import { OKRPageEditor } from '@/components/okr/OKRPageEditor';
import { CreateOKRPageView } from './CreateOKRPageView';
import type { IOKRPage, IObjective, IKeyResult } from '@/types';

interface Props {
  params: Promise<{ teamId: string; year: string }>;
}

export default async function AnnualOKRPage({ params }: Props) {
  const { teamId, year: yearSlug } = await params;

  const year = parseInt(yearSlug, 10);
  if (isNaN(year) || yearSlug.length !== 4) notFound();

  await connectDB();

  const team = await Team.findById(teamId).lean();
  if (!team) notFound();

  const user = await getCurrentUser();
  const canEdit = user ? canEditTeamOKR(user, teamId) : false;

  // Members (non-admin, non-owner) go straight to the presentation view
  if (user && !canEdit) redirect(`/teams/${teamId}/${year}/present`);

  const pageDoc = await OKRPage.findOne({
    teamId,
    'period.type': 'annual',
    'period.year': year,
  }).lean();

  const breadcrumb = (
    <div className="border-b border-gray-200 bg-white px-4 sm:px-6 py-3">
      <nav className="text-sm text-gray-500 flex items-center gap-2">
        <Link href="/" className="hover:text-gray-700">Company</Link>
        <span>/</span>
        <Link href={`/teams/${teamId}`} className="hover:text-gray-700">{team.name}</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{year}</span>
      </nav>
    </div>
  );

  if (!pageDoc) {
    return (
      <div>
        {breadcrumb}
        <CreateOKRPageView
          teamId={teamId}
          year={year}
          teamName={team.name}
          canEdit={canEdit}
        />
      </div>
    );
  }

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

  const serializedPage: IOKRPage = {
    _id: pageDoc._id.toString(),
    teamId,
    period: { type: 'annual', year },
    status: pageDoc.status,
    objectives: serializedObjectives,
    parentOKRPageId: pageDoc.parentOKRPageId?.toString(),
    createdAt: pageDoc.createdAt.toISOString(),
    updatedAt: pageDoc.updatedAt.toISOString(),
  };

  return (
    <div>
      {breadcrumb}
      <OKRPageEditor initialPage={serializedPage} canEdit={canEdit} teamId={teamId} teamIconUrl={team.iconUrl ?? undefined} />
    </div>
  );
}
