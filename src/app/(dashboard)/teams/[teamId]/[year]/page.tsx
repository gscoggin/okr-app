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
import { CreateOKRPageView } from './CreateOKRPageView';
import { SharedObjectivesSection } from '@/components/okr/SharedObjectivesSection';
import { OKRPageStickyHeader, type Crumb } from '@/components/nav/OKRPageStickyHeader';
import { serializeOKRPageWithNested } from '@/lib/serializeOKR';
import type { IOKRPage } from '@/types';

interface Props {
  params: Promise<{ teamId: string; year: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export default async function AnnualOKRPage({ params, searchParams }: Props) {
  const { teamId, year: yearSlug } = await params;
  const { edit } = await searchParams;

  const year = parseInt(yearSlug, 10);
  if (isNaN(year) || yearSlug.length !== 4) notFound();

  await connectDB();

  const team = await Team.findById(teamId).lean();
  if (!team) notFound();

  const user = await getCurrentUser();
  const canEdit = user ? canEditTeamOKR(user, teamId) : false;
  const editMode = canEdit && edit !== undefined;

  const pageDoc = await OKRPage.findOne({
    teamId,
    'period.type': 'annual',
    'period.year': year,
  }).lean();

  const breadcrumbs: Crumb[] = [
    { label: 'Company', href: '/' },
    { label: team.name, href: `/teams/${teamId}` },
    { label: String(year) },
  ];

  if (!pageDoc) {
    return (
      <div>
        <OKRPageStickyHeader breadcrumbs={breadcrumbs} teamId={teamId} />
        <CreateOKRPageView
          teamId={teamId}
          year={year}
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

  const baseHref = `/teams/${teamId}/${year}`;

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
          importPeriod="annual"
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
          importPeriod="annual"
          year={year}
          canImportExport={canEdit}
        />
      )}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <SharedObjectivesSection teamId={teamId} year={year} />
      </div>
    </div>
  );
}
