export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';
import { getCurrentUser, canEditTeamOKR } from '@/lib/auth';
import { OKRPageEditor } from '@/components/okr/OKRPageEditor';
import { PresentationView } from '@/components/presentation/PresentationView';
import { CreateQuarterlyPageView } from './CreateQuarterlyPageView';
import { SharedObjectivesSection } from '@/components/okr/SharedObjectivesSection';
import { ImportExportPanel } from '@/components/okr/ImportExportPanel';
import { serializeOKRPageWithNested } from '@/lib/serializeOKR';
import type { IOKRPage, Quarter } from '@/types';

const VALID_QUARTERS: Record<string, Quarter> = {
  q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4',
};

interface Props {
  params: Promise<{ teamId: string; year: string; quarter: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export default async function QuarterlyOKRPage({ params, searchParams }: Props) {
  const { teamId, year: yearSlug, quarter: quarterSlug } = await params;
  const { edit } = await searchParams;

  const year = parseInt(yearSlug, 10);
  if (isNaN(year) || yearSlug.length !== 4) notFound();

  const quarter = VALID_QUARTERS[quarterSlug.toLowerCase()];
  if (!quarter) notFound();

  await connectDB();

  const team = await Team.findById(teamId).lean();
  if (!team) notFound();

  const user = await getCurrentUser();
  const canEdit = user ? canEditTeamOKR(user, teamId) : false;
  const editMode = canEdit && edit !== undefined;

  const pageDoc = await OKRPage.findOne({
    teamId,
    'period.type': 'quarterly',
    'period.year': year,
    'period.quarter': quarter,
  }).lean();

  const breadcrumb = (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 sm:px-6 py-3">
      <nav className="text-sm text-gray-500 flex items-center gap-2 flex-wrap min-w-0">
        <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-300 shrink-0">Company</Link>
        <span className="shrink-0">/</span>
        <Link href={`/teams/${teamId}`} className="hover:text-gray-700 dark:hover:text-gray-300 truncate max-w-[10rem]">{team.name}</Link>
        <span className="shrink-0">/</span>
        <Link href={`/teams/${teamId}/${year}`} className="hover:text-gray-700 dark:hover:text-gray-300 shrink-0">{year}</Link>
        <span className="shrink-0">/</span>
        <span className="text-gray-800 dark:text-gray-200 font-medium shrink-0">{quarter}</span>
      </nav>
    </div>
  );

  if (!pageDoc) {
    return (
      <div>
        {breadcrumb}
        <CreateQuarterlyPageView
          teamId={teamId}
          year={year}
          quarter={quarter}
          teamName={team.name}
          canEdit={canEdit}
        />
      </div>
    );
  }

  const objectives = await Objective.find({ okrPageId: pageDoc._id }).sort({ sortOrder: 1 }).lean();
  const objectiveIds = objectives.map((o) => o._id);
  const keyResults = await KeyResult.find({ objectiveId: { $in: objectiveIds } }).sort({ sortOrder: 1 }).lean();

  const serializedPage: IOKRPage = serializeOKRPageWithNested(pageDoc, objectives, keyResults);

  const baseHref = `/teams/${teamId}/${year}/${quarterSlug.toLowerCase()}`;

  const toolbar = editMode && (
    <div className="flex justify-end px-4 sm:px-6 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <ImportExportPanel teamId={teamId} year={year} period={quarterSlug.toLowerCase()} teamName={team.name} />
    </div>
  );

  return (
    <div>
      {breadcrumb}
      {toolbar}
      {editMode ? (
        <OKRPageEditor
          initialPage={serializedPage}
          canEdit
          teamId={teamId}
          teamIconUrl={team.iconUrl ?? undefined}
          doneHref={baseHref}
        />
      ) : (
        <PresentationView
          page={serializedPage}
          teamName={team.name}
          teamIconUrl={team.iconUrl ?? undefined}
          editHref={canEdit ? `${baseHref}?edit` : undefined}
          teamId={teamId}
        />
      )}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <SharedObjectivesSection teamId={teamId} year={year} quarter={quarter} />
      </div>
    </div>
  );
}
