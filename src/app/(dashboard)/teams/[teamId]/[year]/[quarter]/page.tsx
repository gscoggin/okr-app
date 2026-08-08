export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
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
import { OKRPageStickyHeader, type Crumb } from '@/components/nav/OKRPageStickyHeader';
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

  const breadcrumbs: Crumb[] = [
    { label: 'Company', href: '/' },
    { label: team.name, href: `/teams/${teamId}` },
    { label: String(year), href: `/teams/${teamId}/${year}` },
    { label: quarter },
  ];

  if (!pageDoc) {
    return (
      <div>
        <OKRPageStickyHeader breadcrumbs={breadcrumbs} teamId={teamId} />
        <CreateQuarterlyPageView
          teamId={teamId}
          year={year}
          quarter={quarter}
          teamName={team.name}
          canEdit={canEdit}
          breadcrumbs={breadcrumbs}
        />
      </div>
    );
  }

  const objectives = await Objective.find({ okrPageId: pageDoc._id }).sort({ sortOrder: 1 }).lean();
  const objectiveIds = objectives.map((o) => o._id);
  const keyResults = await KeyResult.find({ objectiveId: { $in: objectiveIds } }).sort({ sortOrder: 1 }).lean();

  const serializedPage: IOKRPage = serializeOKRPageWithNested(pageDoc, objectives, keyResults);

  const baseHref = `/teams/${teamId}/${year}/${quarterSlug.toLowerCase()}`;
  const importPeriod = quarterSlug.toLowerCase();

  return (
    <div>
      {editMode ? (
        <OKRPageEditor
          initialPage={serializedPage}
          canEdit
          teamId={teamId}
          teamName={team.name}
          teamIconUrl={team.iconUrl ?? undefined}
          doneHref={baseHref}
          breadcrumbs={breadcrumbs}
          importPeriod={importPeriod}
          year={year}
        />
      ) : (
        <PresentationView
          page={serializedPage}
          teamName={team.name}
          teamIconUrl={team.iconUrl ?? undefined}
          editHref={canEdit ? `${baseHref}?edit` : undefined}
          teamId={teamId}
          breadcrumbs={breadcrumbs}
          importPeriod={importPeriod}
          year={year}
          canImportExport={canEdit}
        />
      )}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <SharedObjectivesSection teamId={teamId} year={year} quarter={quarter} />
      </div>
    </div>
  );
}
