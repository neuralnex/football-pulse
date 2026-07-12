'use client';

import { useEffect, useRef, useState } from 'react';
import {
  describeScoreEvent,
  extractLineups,
  formatMatchEndLabel,
  formatMatchMinute,
  type MatchScoreline,
  scoreFromSnapshot,
} from '@/lib/txline/gameState';
import MatchDisplayHeader from '@/components/MatchDisplayHeader';
import { formatKickoffDual, DEFAULT_USER_TIMEZONE, resolveUserTimeZone } from '@/lib/txline/dates';
import type { ScoreSnapshot } from '@/lib/txline/scores';

import type { OddsMarketView } from '@/lib/txline/parser';

interface ProbabilityPoint {
  t: number;
  home: number;
  draw: number;
  away: number;
}

interface NarrativeOutput {
  matchPulse: string;
  whyItMatters: string;
  whatIf: string;
}

interface FeedEntry {
  id: number;
  time: string;
  narrative: NarrativeOutput;
}

interface ScoreEvent {
  id: number;
  minute: string;
  action: string;
  seq: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type Tab = 'summary' | 'odds' | 'events' | 'stats' | 'lineups' | 'chat';

const MAX_POINTS = 40;
const MAX_FEED = 12;

export default function FixtureDashboard({
  fixtureId,
  homeTeam,
  awayTeam,
  startTimeMs: initialStartTimeMs = 0,
  isPulse: initialPulse = false,
}: {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  startTimeMs?: number;
  isPulse?: boolean;
}) {
  const [userTimeZone, setUserTimeZone] = useState(DEFAULT_USER_TIMEZONE);
  const [tab, setTab] = useState<Tab>(initialPulse ? 'summary' : 'events');
  const [history, setHistory] = useState<ProbabilityPoint[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string>('');
  const [gameState, setGameState] = useState('');
  const [matchMinute, setMatchMinute] = useState('');
  const [isLive, setIsLive] = useState(initialPulse);
  const [isPulse, setIsPulse] = useState(initialPulse);
  const [oddsBookmaker, setOddsBookmaker] = useState<string | null>(null);
  const [oddsMarkets, setOddsMarkets] = useState<OddsMarketView[]>([]);
  const [latestProbs, setLatestProbs] = useState<{ home: number; draw: number; away: number } | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [currentScore, setCurrentScore] = useState<MatchScoreline | null>(null);
  const [matchStats, setMatchStats] = useState<{
    possession?: number;
    possessionType?: string;
    stats?: Record<string, number>;
  }>({});
  const [lineups, setLineups] = useState<{
    home: ReturnType<typeof extractLineups>['home'];
    away: ReturnType<typeof extractLineups>['away'];
  }>({ home: [], away: [] });
  const [startTimeMs, setStartTimeMs] = useState(initialStartTimeMs);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [devnetNote, setDevnetNote] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: initialPulse
        ? `FootyPartner is live! Ask me anything about ${homeTeam} vs ${awayTeam} as the match unfolds.`
        : `Viewing match archive for ${homeTeam} vs ${awayTeam}. Ask me about the final score or key moments.`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const feedIdRef = useRef(0);
  const seenSeqRef = useRef(new Set<number>());
  const historyRef = useRef<ScoreSnapshot[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const userTimeZoneRef = useRef(userTimeZone);
  userTimeZoneRef.current = userTimeZone;

  const applyLatestScore = (latest: ScoreSnapshot, history = historyRef.current) => {
    const score = scoreFromSnapshot(latest);
    setCurrentScore(score);
    setGameState(formatMatchEndLabel(latest, history));
    setMatchMinute(formatMatchMinute(latest, history));

    if (latest.stats || latest.possession !== undefined) {
      setMatchStats({
        possession: latest.possession,
        possessionType: latest.possessionType,
        stats: latest.stats,
      });
    }

    const teams = extractLineups(latest);
    if (teams.home.length > 0 || teams.away.length > 0) {
      setLineups(teams);
    }
  };

  const pushScoreEvent = (score: ScoreSnapshot) => {
    if (seenSeqRef.current.has(score.seq)) return;
    seenSeqRef.current.add(score.seq);

    const action = describeScoreEvent(score);
    if (!action) return;

    feedIdRef.current += 1;
    setScoreEvents((prev) =>
      [
        {
          id: feedIdRef.current,
          minute: formatMatchMinute(score, historyRef.current),
          action,
          seq: score.seq,
        },
        ...prev,
      ].slice(0, MAX_FEED)
    );
  };

  useEffect(() => {
    setUserTimeZone(resolveUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const liveHint = initialPulse ? '&streamOnly=true' : '';
        const res = await fetch(
          `/api/fixtures/${fixtureId}/match-data?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}${liveHint}`
        );
        if (!res.ok) {
          setDataLoaded(true);
          return;
        }

        const data = await res.json();
        const live = Boolean(data.isLive ?? data.status === 'live');
        const history = Array.isArray(data.history) ? data.history : [];
        if (history.length > 0) historyRef.current = history;
        if (typeof data.startTimeMs === 'number') setStartTimeMs(data.startTimeMs);
        setMatchStatus(data.status ?? '');

        if (data.latest) {
          applyLatestScore(data.latest as ScoreSnapshot, historyRef.current);
        } else if (data.status === 'unavailable') {
          setGameState('No coverage');
        }

        setIsLive(live);
        setIsPulse(live || initialPulse);
        setDataLoaded(true);

        history.forEach((row: ScoreSnapshot) => pushScoreEvent(row));

        if (data.odds?.probabilities) {
          setLatestProbs({
            home: data.odds.probabilities.homeWin,
            draw: data.odds.probabilities.draw,
            away: data.odds.probabilities.awayWin,
          });
          setOddsBookmaker(data.odds.bookmaker);
          setOddsMarkets(data.odds.markets ?? []);
        }
      } catch (err) {
        console.warn('[dashboard] initial load failed:', err);
        setDataLoaded(true);
      }
    };

    fetchInitial();
  }, [fixtureId, homeTeam, awayTeam, initialPulse]);

  useEffect(() => {
    setConnection('connecting');
    const startParam = startTimeMs > 0 ? `&startTime=${startTimeMs}` : '';
    const url = `/api/fixtures/${fixtureId}/stream?home=${encodeURIComponent(
      homeTeam
    )}&away=${encodeURIComponent(awayTeam)}${startParam}`;
    const source = new EventSource(url);

    source.addEventListener('open', () => setConnection('live'));

    source.addEventListener('meta', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      if (data.devnetDelaySec && data.devnetDelaySec > 0) {
        setDevnetNote(`Devnet feed · AI summaries refresh ~every ${data.devnetDelaySec}s`);
      }
    });

    source.addEventListener('snapshot', (event) => {
      const rows = JSON.parse((event as MessageEvent).data) as ScoreSnapshot[];
      if (!Array.isArray(rows) || rows.length === 0) return;
      historyRef.current = rows;
      const latest = rows[rows.length - 1];
      if (latest) {
        applyLatestScore(latest, rows);
        rows.forEach((row) => pushScoreEvent(row));
      }
      setDataLoaded(true);
    });

    source.addEventListener('stream', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      if (data.status === 'connected') setConnection('live');
    });

    source.addEventListener('odds', (event) => {
      setConnection('live');
      const data = JSON.parse((event as MessageEvent).data);
      if (data.gameState) {
        const prev = historyRef.current[historyRef.current.length - 1];
        const merged = prev
          ? { ...prev, gameState: data.gameState }
          : ({ gameState: data.gameState } as ScoreSnapshot);
        setGameState(formatMatchEndLabel(merged, historyRef.current));
        setMatchMinute(formatMatchMinute(merged, historyRef.current));
      }
      if (data.isLive) {
        setIsLive(true);
        setIsPulse(true);
      }
      if (data.bookmaker) setOddsBookmaker(data.bookmaker);
      if (data.markets) setOddsMarkets(data.markets);
      if (data.probabilities) {
        setLatestProbs({
          home: data.probabilities.homeWin,
          draw: data.probabilities.draw,
          away: data.probabilities.awayWin,
        });
        setHistory((prev) => {
          const next = [
            ...prev,
            {
              t: Date.now(),
              home: data.probabilities.homeWin,
              draw: data.probabilities.draw,
              away: data.probabilities.awayWin,
            },
          ];
          return next.slice(-MAX_POINTS);
        });
      }
    });

    source.addEventListener('score', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      const latest = data.latest as ScoreSnapshot;
      if (!latest) return;
      if (!historyRef.current.some((row) => row.seq === latest.seq)) {
        historyRef.current = [...historyRef.current, latest].sort((a, b) => a.seq - b.seq);
      }
      applyLatestScore(latest, historyRef.current);
      pushScoreEvent(latest);
      if (data.isLive) {
        setIsLive(true);
        setIsPulse(true);
      }
    });

    source.addEventListener('narrative', (event) => {
      const narrative = JSON.parse((event as MessageEvent).data) as NarrativeOutput;
      feedIdRef.current += 1;
      setFeed((prev) =>
        [
          {
            id: feedIdRef.current,
            time: new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: userTimeZoneRef.current,
            }),
            narrative,
          },
          ...prev,
        ].slice(0, MAX_FEED)
      );
    });

    source.addEventListener('error', () => setConnection('error'));

    return () => source.close();
  }, [fixtureId, homeTeam, awayTeam, startTimeMs]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`/api/fixtures/${fixtureId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, homeTeam, awayTeam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Couldn't reach the AI right now — live data may still be syncing." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-4xl px-4 py-6 pb-24">
        <a
          href="/"
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-light)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--border)]"
        >
          ← All matches
        </a>

        <MatchDisplayHeader
          className="mb-6"
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          scoreHome={currentScore?.home}
          scoreAway={currentScore?.away}
          isPulse={isPulse}
          minute={matchMinute}
          statusLabel={
            !isPulse ? gameState || (dataLoaded ? 'Match archive' : 'Loading…') : undefined
          }
        >
          {startTimeMs > 0 && (
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Kickoff {formatKickoffDual(startTimeMs, userTimeZone)}
            </p>
          )}

          {currentScore && (
            <div className="mt-5 flex justify-center gap-6 border-t border-[var(--border)] pt-5 text-xs text-[var(--text-muted)]">
              <span>🟨 {currentScore.homeYellows} / {currentScore.awayYellows}</span>
              <span>🟥 {currentScore.homeReds} / {currentScore.awayReds}</span>
              <span>🚩 {currentScore.homeCorners} / {currentScore.awayCorners}</span>
            </div>
          )}

          {devnetNote && isPulse && (
            <p className="mt-4 text-center text-xs text-[var(--accent)]">{devnetNote}</p>
          )}
          {!isPulse && dataLoaded && (
            <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
              AI summaries and live odds are available during live matches.
            </p>
          )}
        </MatchDisplayHeader>

        {!dataLoaded && (
          <section className="match-card mb-4 p-8">
            <div className="animate-pulse space-y-4 py-4">
              <div className="mx-auto h-12 w-32 rounded bg-[var(--surface-light)]" />
              <div className="mx-auto h-4 w-48 rounded bg-[var(--surface-light)]" />
            </div>
          </section>
        )}

        <nav className="tab-nav mb-6">
          {(
            [
              ['summary', 'Summary'],
              ...(isPulse ? [['odds', 'Odds'] as const] : []),
              ['events', 'Events'],
              ['stats', 'Stats'],
              ['lineups', 'Lineups'],
              ['chat', 'Ask AI'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`tab-btn ${tab === key ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'summary' && (
          <div className="space-y-4">
            {(latestProbs || history.length > 0) && (
              <section className="match-card p-5">
                <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Win probability {oddsBookmaker ? `· ${oddsBookmaker}` : ''}
                </h2>
                <OddsBar
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  probs={latestProbs ?? history[history.length - 1]}
                />
              </section>
            )}

            <section className="match-card p-5">
              <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {isPulse ? 'AI match summary' : 'Match summary'}
              </h2>
              {!isPulse && feed.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">
                  Archive view — explore events and stats from this match. Live summaries appear during play.
                </p>
              )}
              {isPulse && feed.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">
                  Waiting for the first AI summary — odds and scores update live.
                </p>
              )}
              <div className="space-y-4">
                {feed.map((entry) => (
                  <FeedCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'odds' && isPulse && (
          <section className="match-card p-5">
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Live odds</h2>
            {oddsBookmaker && (
              <p className="mb-4 text-sm text-[var(--accent)]">Source: {oddsBookmaker}</p>
            )}
            {oddsMarkets.length === 0 && !latestProbs ? (
              <p className="text-sm text-[var(--text-muted)]">Odds syncing from TxLINE…</p>
            ) : (
              <div className="space-y-4">
                {latestProbs && (
                  <OddsBar homeTeam={homeTeam} awayTeam={awayTeam} probs={latestProbs} />
                )}
                {oddsMarkets.map((market, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-light)] p-4">
                    <div className="mb-3 flex justify-between text-xs text-[var(--text-muted)]">
                      <span>{market.bookmaker}</span>
                      <span>{market.marketPeriod} · {market.inRunning ? 'In-play' : 'Pre-match'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {market.selections.map((sel) => (
                        <div
                          key={sel.name}
                          className="rounded-lg bg-[var(--bg)] p-3 text-center"
                        >
                          <p className="text-xs text-[var(--text-muted)]">{sel.name}</p>
                          <p className="text-2xl font-extrabold text-[var(--accent)]">
                            {sel.pct != null ? `${sel.pct.toFixed(1)}%` : '—'}
                          </p>
                          {sel.price != null && (
                            <p className="text-[10px] text-[var(--text-muted)]">{sel.price}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'events' && (
          <section className="match-card p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Match events
            </h2>
            {scoreEvents.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No events yet — the match may be about to kick off.</p>
            ) : (
              <div className="space-y-3">
                {scoreEvents.map((event) => (
                  <div key={event.seq} className="event-item">
                    <span className="min-w-[40px] text-sm font-bold text-[var(--accent)]">{event.minute}</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs">
                      ⚽
                    </span>
                    <span className="text-sm">{event.action}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'stats' && (
          <section className="match-card p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Match statistics
            </h2>
            {matchStats.stats && Object.keys(matchStats.stats).length > 0 ? (
              <MatchStatsDisplay stats={matchStats} homeTeam={homeTeam} awayTeam={awayTeam} />
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Stats will appear once live coverage begins.</p>
            )}
          </section>
        )}

        {tab === 'lineups' && (
          <section className="match-card p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Lineups
            </h2>
            {lineups.home.length > 0 || lineups.away.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <LineupsDisplay title={homeTeam} players={lineups.home} />
                <LineupsDisplay title={awayTeam} players={lineups.away} />
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Lineups not available yet.</p>
            )}
          </section>
        )}

        {tab === 'chat' && (
          <section className="match-card flex h-[min(70vh,560px)] flex-col overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Ask about the match
              </h2>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    msg.role === 'user'
                      ? 'ml-auto bg-[var(--accent)] text-white'
                      : 'mr-auto border border-[var(--border)] bg-[var(--surface-light)]'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <p className="text-sm text-[var(--text-muted)]">Thinking…</p>
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className="flex gap-2 border-t border-[var(--border)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Who's winning? What just happened?"
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function MatchStatsDisplay({
  stats,
  homeTeam,
  awayTeam,
}: {
  stats: { possession?: number; possessionType?: string; stats?: Record<string, number> };
  homeTeam: string;
  awayTeam: string;
}) {
  const statKeys = Object.keys(stats.stats || {}).slice(0, 8);

  return (
    <div className="space-y-6">
      {stats.possession !== undefined && (
        <div className="stat-row">
          <div className="mb-2 flex justify-between text-sm font-semibold">
            <span>{stats.possession}%</span>
            <span className="text-[var(--text-muted)]">Possession</span>
            <span>{100 - stats.possession}%</span>
          </div>
          <div className="stat-bar-bg">
            <div className="stat-bar-left" style={{ width: `${stats.possession}%` }} />
            <div className="stat-bar-right" style={{ width: `${100 - stats.possession}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--text-muted)]">
            <span>{homeTeam}</span>
            <span>{awayTeam}</span>
          </div>
        </div>
      )}
      {statKeys.map((key) => {
        const val = stats.stats?.[key] ?? 0;
        const half = Math.max(val / 2, 1);
        return (
          <div key={key} className="stat-row">
            <div className="mb-2 flex justify-between text-sm font-semibold">
              <span>{val}</span>
              <span className="text-xs text-[var(--text-muted)]">{key}</span>
              <span>—</span>
            </div>
            <div className="stat-bar-bg">
              <div className="stat-bar-left" style={{ width: `${Math.min(half, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineupsDisplay({
  title,
  players,
}: {
  title: string;
  players: Array<{
    fixturePlayerId: number;
    rosterNumber: string;
    starter: boolean;
    player: { preferredName: string };
  }>;
}) {
  const starters = players.filter((p) => p.starter);
  const subs = players.filter((p) => !p.starter);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[var(--accent)]">{title}</h3>
      <div className="space-y-2">
        {starters.map((player) => (
          <div key={player.fixturePlayerId} className="flex items-center gap-3 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-dim)] text-xs font-bold text-[var(--accent)]">
              {player.rosterNumber}
            </span>
            <span>{player.player.preferredName}</span>
          </div>
        ))}
      </div>
      {subs.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs uppercase tracking-wider text-[var(--text-muted)]">Subs</p>
          <div className="space-y-2">
            {subs.map((player) => (
              <div key={player.fixturePlayerId} className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-xs">
                  {player.rosterNumber}
                </span>
                <span>{player.player.preferredName}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OddsBar({
  homeTeam,
  awayTeam,
  probs,
}: {
  homeTeam: string;
  awayTeam: string;
  probs: { home: number; draw: number; away: number };
}) {
  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-light)]">
        <div className="bg-[var(--accent)] transition-all" style={{ width: `${probs.home}%` }} />
        <div className="bg-[var(--text-muted)] transition-all" style={{ width: `${probs.draw}%` }} />
        <div className="bg-blue-500 transition-all" style={{ width: `${probs.away}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <ProbBadge label={homeTeam} value={probs.home} />
        <ProbBadge label="DRAW" value={probs.draw} muted />
        <ProbBadge label={awayTeam} value={probs.away} />
      </div>
    </div>
  );
}

function ProbBadge({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <span
        className={`text-2xl font-extrabold ${muted ? 'text-[var(--text-muted)]' : 'text-[var(--accent)]'}`}
      >
        {value.toFixed(1)}%
      </span>
      <span className="max-w-[90px] truncate text-center text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}

function FeedCard({ entry }: { entry: FeedEntry }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-light)] p-4">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
        {entry.time}
      </div>
      <p className="mb-3 text-base leading-7">{entry.narrative.matchPulse}</p>
      <p className="mb-2 text-sm leading-6 text-[var(--text-muted)]">
        <span className="text-[var(--accent)]">Why it matters — </span>
        {entry.narrative.whyItMatters}
      </p>
      <p className="text-sm leading-6 text-[var(--text-muted)]">
        <span>What if — </span>
        {entry.narrative.whatIf}
      </p>
    </article>
  );
}
