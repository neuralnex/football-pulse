'use client';

import { useState, useEffect, useMemo } from 'react';
import { BOARD_TIMEZONE, getEpochDay } from '@/lib/txline/dates';

function formatDayLabel(epochDay: number, today: number): string {
  if (epochDay === today) return 'Today';
  if (epochDay === today - 1) return 'Yesterday';
  if (epochDay === today + 1) return 'Tomorrow';
  const ms = epochDay * 86400000;
  return new Date(ms).toLocaleDateString('en-GB', {
    timeZone: BOARD_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatKickoff(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BOARD_TIMEZONE,
  });
}

interface BoardFixture {
  FixtureId: number;
  Competition: string;
  StartTime: number;
  homeTeam: string;
  awayTeam: string;
  status: 'upcoming' | 'live' | 'finished';
  gameStateLabel: string;
  minute: string;
  scoreHome: number | null;
  scoreAway: number | null;
  isPulse: boolean;
}

export default function HomePage() {
  const today = useMemo(() => getEpochDay(new Date()), []);
  const [selectedDay, setSelectedDay] = useState(today);
  const [fixtures, setFixtures] = useState<BoardFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let backoffMs = 0;

    const loadBoard = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(`/api/fixtures/board?epochDay=${selectedDay}`, {
          signal: controller.signal,
        });
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
  }, [selectedDay]);

  const filtered = fixtures.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.homeTeam.toLowerCase().includes(q) || f.awayTeam.toLowerCase().includes(q);
  });

  const liveCount = fixtures.filter((f) => f.status === 'live').length;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="font-display-var text-3xl tracking-wide">
            Football<span className="gold-gradient-text">Pulse</span>
          </h1>
          <div className="hidden sm:flex flex-1 max-w-xs">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams…"
              className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--floodlight)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--gold)]"
            />
          </div>
          {liveCount > 0 && (
            <span className="flex items-center gap-2 rounded-full border border-[var(--gold)]/30 bg-[var(--gold-dim)] px-3 py-1 text-xs font-medium text-[var(--gold)]">
              <span className="pulse-live h-2 w-2 rounded-full bg-[var(--pulse)]" />
              {liveCount} live
            </span>
          )}
        </div>

        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 pb-3">
          {Array.from({ length: 18 }, (_, i) => today - 14 + i).map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                selectedDay === day
                  ? 'bg-[var(--gold)] text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--floodlight)]'
              }`}
            >
              {formatDayLabel(day, today)}
            </button>
          ))}
          <button
            onClick={() => setSelectedDay((d) => d - 1)}
            className="ml-auto shrink-0 rounded-lg px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--gold)]"
          >
            ← Earlier
          </button>
          <button
            onClick={() => setSelectedDay((d) => d + 1)}
            className="shrink-0 rounded-lg px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--gold)]"
          >
            Later →
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="mb-6 text-sm text-[var(--muted)]">
          Live matches get the full Pulse experience — AI summaries, odds, and chat. Tap any match to
          explore scores and events.
        </p>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="match-card h-28 animate-pulse bg-[var(--surface)]" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="match-card p-10 text-center">
            <p className="text-[var(--muted)]">No World Cup fixtures for this day.</p>
          </div>
        )}

        <div className="space-y-3">
          {!loading &&
            filtered.map((fixture) => (
              <MatchCard key={fixture.FixtureId} fixture={fixture} />
            ))}
        </div>
      </main>
    </div>
  );
}

function MatchCard({ fixture }: { fixture: BoardFixture }) {
  const href = `/fixture/${fixture.FixtureId}?home=${encodeURIComponent(fixture.homeTeam)}&away=${encodeURIComponent(fixture.awayTeam)}`;

  const statusBadge = () => {
    if (fixture.status === 'live') {
      return (
        <span className="flex items-center gap-2 font-display-var text-lg text-[var(--gold)]">
          <span className="pulse-live inline-block h-2.5 w-2.5 rounded-full bg-[var(--pulse)]" />
          {fixture.minute}
        </span>
      );
    }
    if (fixture.status === 'finished') {
      return <span className="text-sm font-medium text-[var(--muted)]">FT</span>;
    }
    return <span className="text-sm text-[var(--muted)]">{formatKickoff(fixture.StartTime)}</span>;
  };

  const scoreDisplay = () => {
    if (fixture.scoreHome != null && fixture.scoreAway != null) {
      return (
        <span className="font-display-var text-4xl font-semibold tracking-wider text-[var(--floodlight)]">
          {fixture.scoreHome} <span className="text-[var(--muted)]">-</span> {fixture.scoreAway}
        </span>
      );
    }
    return <span className="font-display-var text-2xl text-[var(--muted)]">vs</span>;
  };

  return (
    <a
      href={href}
      className={`match-card block p-5 ${fixture.isPulse ? 'match-card-live' : ''}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
          {fixture.Competition}
        </span>
        <div className="flex items-center gap-3">
          {fixture.isPulse && (
            <span className="rounded-full bg-[var(--gold-dim)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">
              Pulse
            </span>
          )}
          {statusBadge()}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className="truncate text-right font-heading-var text-base font-semibold sm:text-lg">
          {fixture.homeTeam}
        </p>
        {scoreDisplay()}
        <p className="truncate font-heading-var text-base font-semibold sm:text-lg">
          {fixture.awayTeam}
        </p>
      </div>

      {fixture.status === 'finished' && (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          {fixture.gameStateLabel} · tap to view match archive
        </p>
      )}
      {fixture.status === 'upcoming' && (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">Kickoff {formatKickoff(fixture.StartTime)}</p>
      )}
    </a>
  );
}
