import FixtureDashboard from './FixtureDashboard';
import { getFixtureById } from '@/lib/txline/fixtures';

export default async function FixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ fixtureId: string }>;
  searchParams: Promise<{ home?: string; away?: string }>;
}) {
  const { fixtureId } = await params;
  const { home, away } = await searchParams;

  let homeTeam = home;
  let awayTeam = away;

  if (!homeTeam || !awayTeam) {
    const fixture = await getFixtureById(Number(fixtureId));
    if (fixture) {
      if (fixture.Participant1IsHome) {
        homeTeam = fixture.Participant1;
        awayTeam = fixture.Participant2;
      } else {
        homeTeam = fixture.Participant2;
        awayTeam = fixture.Participant1;
      }
    }
  }

  return (
    <FixtureDashboard
      fixtureId={fixtureId}
      homeTeam={homeTeam ?? 'Home'}
      awayTeam={awayTeam ?? 'Away'}
    />
  );
}
