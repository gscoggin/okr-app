export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { connectDB } from '@/lib/mongodb';
import Team from '@/models/Team';
import OKRPage from '@/models/OKRPage';

interface Props {
  params: Promise<{ teamId: string }>;
}

/** Redirect to the most recent OKR period for this team */
export default async function TeamRootPage({ params }: Props) {
  const { teamId } = await params;
  await connectDB();

  const team = await Team.findById(teamId).lean();
  if (!team) notFound();

  const currentYear = new Date().getFullYear();
  const currentQ = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

  // Try to find the current quarter first, then annual, then most recent
  const quarterPage = await OKRPage.findOne({
    teamId,
    'period.year': currentYear,
    'period.type': 'quarterly',
    'period.quarter': currentQ,
  }).lean();

  if (quarterPage) {
    redirect(`/teams/${teamId}/${currentYear}-${currentQ.toLowerCase()}`);
  }

  const annualPage = await OKRPage.findOne({
    teamId,
    'period.year': currentYear,
    'period.type': 'annual',
  }).lean();

  if (annualPage) {
    redirect(`/teams/${teamId}/${currentYear}`);
  }

  // No OKR pages yet — redirect to current quarter URL (will show empty state)
  redirect(`/teams/${teamId}/${currentYear}-${currentQ.toLowerCase()}`);
}
