import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ teamId: string; year: string }>;
}

export default async function AnnualPresentRedirect({ params }: Props) {
  const { teamId, year } = await params;
  redirect(`/teams/${teamId}/${year}`);
}
