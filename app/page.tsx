'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import MatchDisplayHeader from '@/components/MatchDisplayHeader';
import {
  DEFAULT_USER_TIMEZONE,
  getEpochDay,
  formatEpochDayLabel,
  formatHostDayHint,
  formatKickoffDual,
  formatTimezoneShort,
  resolveUserTimeZone,
  WC_2026_START_EPOCH_DAY,
  WC_2026_DURATION_DAYS,
} from '@/lib/txline/dates';

interface BoardFixture {
  FixtureId: number;
  Competition: string;
  StartTime: number;
  homeTeam: string;
  awayTeam: string;
  status: 'upcoming' | 'live' | 'finished' | 'unavailable';
  gameStateLabel: string;
  minute: string;
  resultLabel: 'FT' | 'AET' | 'Pens' | null;
  scoreHome: number | null;
  scoreAway: number | null;
  isPulse: boolean;
}

export default function HomePage() {
  const tournamentDays = useMemo(
    () => Array.from({ length: WC_2026_DURATION_DAYS }, (_, i) => WC_2026_START_EPOCH_DAY + i),
    []
  );
  const [userTimeZone, setUserTimeZone] = useState(DEFAULT_USER_TIMEZONE);
  const [today, setToday] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(WC_2026_START_EPOCH_DAY);
  const [fixtures, setFixtures] = useState<BoardFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const dateTabsRef = useRef<HTMLDivElement | null>(null);
  const dateButtonRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    const detected = resolveUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setUserTimeZone(detected);
    const current = getEpochDay(new Date(), detected);
    setToday(current);
    if (current >= WC_2026_START_EPOCH_DAY && current < WC_2026_START_EPOCH_DAY + WC_2026_DURATION_DAYS) {
      setSelectedDay(current);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 0;

    const loadBoard = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(
          `/api/fixtures/board?epochDay=${selectedDay}&timeZone=${encodeURIComponent(userTimeZone)}`,
          { signal: controller.signal }
        );
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After') || '30');
          backoffMs = Math.min(retryAfter * 1000, 120_000);
          return;
        }
        backoffMs = 0;
        if (res.ok) setFixtures(await res.json());
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') setFixtures([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    };

    void loadBoard(true);

    const scheduleRefresh = () => {
      const jitter = Math.floor(Math.random() * 10_000);
      const base = 45_000 + jitter + backoffMs;
      refreshTimer = setTimeout(() => {
        void loadBoard(false).finally(scheduleRefresh);
      }, base);
    };
    scheduleRefresh();

    return () => {
      controller.abort();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [selectedDay, userTimeZone]);

  useEffect(() => {
    if (today === null) return;
    const tabList = dateTabsRef.current;
    const activeTab = dateButtonRefs.current.get(selectedDay);
    if (!tabList || !activeTab) return;
    const nextLeft = activeTab.offsetLeft - tabList.clientWidth / 2 + activeTab.clientWidth / 2;
    tabList.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' });
  }, [selectedDay, today]);

  const filtered = fixtures.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.homeTeam.toLowerCase().includes(q) || f.awayTeam.toLowerCase().includes(q);
  });

  const liveFixtures = filtered.filter((f) => f.status === 'live');
  const upcomingFixtures = filtered.filter((f) => f.status === 'upcoming');
  const finishedFixtures = filtered.filter((f) => f.status === 'finished');

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="ls-header sticky top-0 z-30 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <div className="ls-logo-icon">⚽</div>
            <h1 className="text-xl font-extrabold tracking-tight">
              Footy<span className="gold-gradient-text">Partner</span>
            </h1>
          </div>
          <div className="hidden flex-1 max-w-xs sm:block">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nations…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-light)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          {liveFixtures.length > 0 && (
            <span className="live-badge">
              <span className="live-dot" />
              {liveFixtures.length} live
            </span>
          )}
        </div>

        <div className="mx-auto max-w-4xl px-4 pb-4">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            FIFA World Cup 2026 · {formatTimezoneShort(userTimeZone)} · host kickoffs in US Eastern
          </p>
          <div ref={dateTabsRef} className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {tournamentDays.map((day) => (
              <button
                key={day}
                ref={(node) => {
                  if (node) dateButtonRefs.current.set(day, node);
                  else dateButtonRefs.current.delete(day);
                }}
                onClick={() => setSelectedDay(day)}
                className={`day-tab ${selectedDay === day ? 'active' : ''}`}
                title={formatHostDayHint(day, userTimeZone) ?? undefined}
              >
                {today === null ? '…' : formatEpochDayLabel(day, today, userTimeZone)}
              </button>
            ))}
            <button
              onClick={() => setSelectedDay((d) => Math.max(WC_2026_START_EPOCH_DAY, d - 1))}
              className="ml-auto shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              ← Earlier
            </button>
            <button
              onClick={() =>
                setSelectedDay((d) =>
                  Math.min(WC_2026_START_EPOCH_DAY + WC_2026_DURATION_DAYS - 1, d + 1)
                )
              }
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              Later →
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="order-2 space-y-6 lg:order-1">
            <TournamentOverview />
          </aside>

          <section className="order-1 space-y-4 lg:order-2">
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="detail-header h-52 animate-pulse bg-[var(--surface)]" />
                ))}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="detail-header p-12">
                <p className="text-[var(--text-muted)]">No World Cup fixtures for this day.</p>
              </div>
            )}

            {!loading && liveFixtures.length > 0 && (
              <>
                <h2 className="section-title">
                  <span className="live-dot" /> Live Now
                </h2>
                <FixtureList fixtures={liveFixtures} userTimeZone={userTimeZone} />
              </>
            )}

            {!loading && finishedFixtures.length > 0 && (
              <>
                <h2 className="section-title">
                  <span>🏁</span> Full Time
                </h2>
                <FixtureList fixtures={finishedFixtures} userTimeZone={userTimeZone} />
              </>
            )}

            {!loading && upcomingFixtures.length > 0 && (
              <>
                <h2 className="section-title">
                  <span>⏰</span> Upcoming
                </h2>
                <FixtureList fixtures={upcomingFixtures} userTimeZone={userTimeZone} />
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

const TOURNAMENT_STATS = [
  { label: 'Total Goals', value: '172' },
  { label: 'Matches', value: '48' },
  { label: 'Yellow Cards', value: '210' },
  { label: 'Red Cards', value: '8' },
  { label: 'Avg Goals / Match', value: '3.58' },
];

function TournamentOverview() {
  return (
    <div className="match-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--text)]">
        World Cup 2026
      </h2>
      <div className="space-y-3">
        {TOURNAMENT_STATS.map((stat) => (
          <div key={stat.label} className="stat-tile flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">{stat.label}</span>
            <span className="text-xl font-extrabold tabular-nums text-[var(--text)]">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function fixtureHref(fixture: BoardFixture): string {
  return `/fixture/${fixture.FixtureId}?home=${encodeURIComponent(fixture.homeTeam)}&away=${encodeURIComponent(fixture.awayTeam)}`;
}

function FixtureList({
  fixtures,
  userTimeZone,
}: {
  fixtures: BoardFixture[];
  userTimeZone: string;
}) {
  return (
    <div className="space-y-4">
      {fixtures.map((fixture) => (
        <BoardFixtureCard key={fixture.FixtureId} fixture={fixture} userTimeZone={userTimeZone} />
      ))}
    </div>
  );
}

function BoardFixtureCard({
  fixture,
  userTimeZone,
}: {
  fixture: BoardFixture;
  userTimeZone: string;
}) {
  const isLive = fixture.status === 'live';

  return (
    <MatchDisplayHeader
      href={fixtureHref(fixture)}
      homeTeam={fixture.homeTeam}
      awayTeam={fixture.awayTeam}
      competition={fixture.Competition}
      scoreHome={fixture.scoreHome}
      scoreAway={fixture.scoreAway}
      isLive={isLive}
      isPulse={fixture.isPulse}
      minute={fixture.minute}
      statusLabel={
        !isLive
          ? fixture.status === 'finished'
            ? fixture.gameStateLabel || fixture.minute
            : undefined
          : undefined
      }
      kickoffLabel={
        fixture.status === 'upcoming'
          ? `Kickoff ${formatKickoffDual(fixture.StartTime, userTimeZone)}`
          : undefined
      }
      footerNote={
        isLive
          ? 'Tap for AI summaries, live odds & chat'
          : fixture.status === 'finished'
            ? 'Tap to view match archive'
            : undefined
      }
    />
  );
}
