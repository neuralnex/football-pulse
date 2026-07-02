// app/page.tsx
import { getFixtureSnapshot, FixtureSnapshot } from '@/lib/txline/fixtures';

const MAX_FIXTURES = 12;

const FALLBACK_FIXTURES: FixtureSnapshot[] = [
  {
    Ts: 0,
    StartTime: Date.now(),
    Competition: 'Demo Cup',
    CompetitionId: 0,
    FixtureGroupId: 0,
    Participant1Id: 1,
    Participant1: 'Argentina',
    Participant2Id: 2,
    Participant2: 'Nigeria',
    FixtureId: 500001,
    Participant1IsHome: true,
  },
  {
    Ts: 0,
    StartTime: Date.now(),
    Competition: 'Demo Cup',
    CompetitionId: 0,
    FixtureGroupId: 0,
    Participant1Id: 3,
    Participant1: 'Brazil',
    Participant2Id: 4,
    Participant2: 'Cameroon',
    FixtureId: 500002,
    Participant1IsHome: true,
  },
];

export default async function HomePage() {
  let fixtures: FixtureSnapshot[] = FALLBACK_FIXTURES;

  try {
    const today = new Date();
    const utcMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const startEpochDay = Math.floor(utcMidnight.getTime() / 86400000);
    fixtures = await getFixtureSnapshot({ startEpochDay });
  } catch (err) {
    console.warn('[home] failed to load fixture snapshot, falling back to demo fixtures', err);
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
        FOOTBALL PULSE
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: 32 }}>
        Live World Cup intelligence, powered by TxLINE + Gemini.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fixtures.slice(0, MAX_FIXTURES).map((fixture) => {
          const home = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
          const away = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;
          return (
            <a
              key={fixture.FixtureId}
              href={`/fixture/${fixture.FixtureId}?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`}
              style={{
                display: 'block',
                padding: '16px 20px',
                border: '1px solid var(--hairline)',
                borderRadius: 4,
                background: 'var(--surface)',
                textDecoration: 'none',
                color: 'var(--floodlight)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                {fixture.Competition} · FIXTURE {fixture.FixtureId}
              </span>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 4 }}>
                {home} vs {away}
              </div>
            </a>
          );
        })}
      </div>

      <p style={{ marginTop: 40, fontSize: 13, color: 'var(--muted)' }}>
        API only: <code>/api/health</code> · <code>/api/fixtures/[fixtureId]/odds</code> ·{' '}
        <code>/api/fixtures/[fixtureId]/narrative</code> ·{' '}
        <code>/api/fixtures/[fixtureId]/stream</code> ·{' '}
        <code>/api/fixtures/[fixtureId]/voice</code>
      </p>
    </main>
  );
}
