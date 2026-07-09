import { redirect } from 'next/navigation';

export default async function MatchRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ home?: string; away?: string }>;
}) {
  const { id } = await params;
  const { home, away } = await searchParams;
  const query = new URLSearchParams();
  if (home) query.set('home', home);
  if (away) query.set('away', away);
  const qs = query.toString();
  redirect(`/fixture/${id}${qs ? `?${qs}` : ''}`);
}
