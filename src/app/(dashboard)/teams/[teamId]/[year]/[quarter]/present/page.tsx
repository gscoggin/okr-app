import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ teamId: string; year: string; quarter: string }>;
}

export default async function QuarterlyPresentRedirect({ params }: Props) {
  const { teamId, year, quarter } = await params;
  redirect(`/teams/${teamId}/${year}/${quarter.toLowerCase()}`);
}
