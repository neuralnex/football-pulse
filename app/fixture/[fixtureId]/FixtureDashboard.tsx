'use client';

import { useEffect, useRef, useState } from 'react';

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
  voiceScript: string;
}

interface FeedEntry {
  id: number;
  time: string;
  narrative: NarrativeOutput;
}

const MAX_POINTS = 40;
const MAX_FEED = 12;

export default function FixtureDashboard({
  fixtureId,
  homeTeam,
  awayTeam,
}: {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
}) {
  const [history, setHistory] = useState<ProbabilityPoint[]>([]);
  const [gameState, setGameState] = useState('CONNECTING');
  const [isLive, setIsLive] = useState(false);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const feedIdRef = useRef(0);

  useEffect(() => {
    const url = `/api/fixtures/${fixtureId}/stream?home=${encodeURIComponent(
      homeTeam
    )}&away=${encodeURIComponent(awayTeam)}`;
    const source = new EventSource(url);

    source.addEventListener('open', () => setConnection('live'));

    source.addEventListener('odds', (event) => {
      setConnection('live');
      const data = JSON.parse((event as MessageEvent).data);
      setGameState(data.gameState ?? 'LIVE');
      setIsLive(Boolean(data.isLive));
      if (data.probabilities) {
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

    source.addEventListener('narrative', (event) => {
      const narrative = JSON.parse((event as MessageEvent).data) as NarrativeOutput;
      feedIdRef.current += 1;
      setFeed((prev) =>
        [
          {
            id: feedIdRef.current,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            narrative,
          },
          ...prev,
        ].slice(0, MAX_FEED)
      );
    });

    source.addEventListener('error', () => setConnection('error'));

    return () => source.close();
  }, [fixtureId, homeTeam, awayTeam]);

  const latest = history[history.length - 1];

  const playVoice = async () => {
    setVoiceLoading(true);
    try {
      const url = `/api/fixtures/${fixtureId}/voice?home=${encodeURIComponent(
        homeTeam
      )}&away=${encodeURIComponent(awayTeam)}`;
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } finally {
      setVoiceLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <ScoreBug
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        gameState={gameState}
        isLive={isLive}
        connection={connection}
      />

      <div style={styles.grid}>
        <section style={styles.pulseSection}>
          <h2 style={styles.sectionLabel}>PULSE METER</h2>
          <PulseMeter history={history} homeTeam={homeTeam} awayTeam={awayTeam} />
          {latest && (
            <div style={styles.probRow}>
              <ProbBadge label={homeTeam} value={latest.home} />
              <ProbBadge label="DRAW" value={latest.draw} muted />
              <ProbBadge label={awayTeam} value={latest.away} />
            </div>
          )}
        </section>

        <section style={styles.feedSection}>
          <h2 style={styles.sectionLabel}>SMART FEED</h2>
          <div style={styles.feedList}>
            {feed.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                Waiting for the first live update…
              </p>
            )}
            {feed.map((entry) => (
              <FeedCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </div>

      <button
        style={styles.voiceButton}
        onClick={playVoice}
        disabled={voiceLoading}
        aria-label="Play voice commentary"
      >
        {voiceLoading ? '···' : '● ON AIR'}
      </button>
      <audio ref={audioRef} />
    </div>
  );
}

function ScoreBug({
  homeTeam,
  awayTeam,
  gameState,
  isLive,
  connection,
}: {
  homeTeam: string;
  awayTeam: string;
  gameState: string;
  isLive: boolean;
  connection: 'connecting' | 'live' | 'error';
}) {
  return (
    <header style={styles.scoreBug}>
      <div style={styles.matchup}>
        <span style={styles.teamName}>{homeTeam}</span>
        <span style={styles.vs}>vs</span>
        <span style={styles.teamName}>{awayTeam}</span>
      </div>
      <div style={styles.stateBlock}>
        <span
          style={{
            ...styles.liveDot,
            background: isLive ? 'var(--pulse)' : 'var(--muted)',
          }}
        />
        <span style={styles.gameState}>{gameState}</span>
        <span style={{ ...styles.connectionText, color: connectionColor(connection) }}>
          {connection === 'live' ? 'LIVE' : connection === 'error' ? 'RECONNECTING' : 'CONNECTING'}
        </span>
      </div>
    </header>
  );
}

function connectionColor(status: 'connecting' | 'live' | 'error') {
  if (status === 'live') return 'var(--pulse)';
  if (status === 'error') return 'var(--gold)';
  return 'var(--muted)';
}

function PulseMeter({
  history,
  homeTeam,
  awayTeam,
}: {
  history: ProbabilityPoint[];
  homeTeam: string;
  awayTeam: string;
}) {
  const width = 800;
  const height = 220;
  const padding = 16;

  if (history.length < 2) {
    return (
      <div style={styles.pulsePlaceholder}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="var(--hairline)"
            strokeWidth={2}
          />
        </svg>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -12 }}>
          Waiting for enough data points to draw the pulse…
        </p>
      </div>
    );
  }

  const toPath = (key: 'home' | 'away') => {
    const step = (width - padding * 2) / (history.length - 1);
    return history
      .map((point, i) => {
        const x = padding + i * step;
        const y = height - padding - (point[key] / 100) * (height - padding * 2);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Win probability over time">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={0}
          x2={width}
          y1={height * f}
          y2={height * f}
          stroke="var(--hairline)"
          strokeWidth={1}
        />
      ))}
      <path d={toPath('away')} fill="none" stroke="var(--muted)" strokeWidth={2} opacity={0.6} />
      <path
        d={toPath('home')}
        fill="none"
        stroke="var(--pulse)"
        strokeWidth={3}
        filter="url(#glow)"
      />
      <text x={padding} y={16} fill="var(--pulse)" fontFamily="var(--font-mono)" fontSize={11}>
        {homeTeam}
      </text>
      <text x={padding} y={height - 4} fill="var(--muted)" fontFamily="var(--font-mono)" fontSize={11}>
        {awayTeam}
      </text>
    </svg>
  );
}

function ProbBadge({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div style={styles.probBadge}>
      <span style={{ ...styles.probValue, color: muted ? 'var(--muted)' : 'var(--pulse)' }}>
        {value.toFixed(0)}%
      </span>
      <span style={styles.probLabel}>{label}</span>
    </div>
  );
}

function FeedCard({ entry }: { entry: FeedEntry }) {
  return (
    <article style={styles.feedCard}>
      <div style={styles.feedTime}>{entry.time}</div>
      <p style={styles.feedPulse}>{entry.narrative.matchPulse}</p>
      <p style={styles.feedWhy}>
        <span style={{ color: 'var(--gold)' }}>WHY IT MATTERS — </span>
        {entry.narrative.whyItMatters}
      </p>
      <p style={styles.feedWhatIf}>
        <span style={{ color: 'var(--muted)' }}>WHAT IF — </span>
        {entry.narrative.whatIf}
      </p>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '24px 32px 96px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  scoreBug: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--hairline)',
    paddingBottom: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  matchup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
  },
  teamName: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    letterSpacing: 0.5,
  },
  vs: {
    color: 'var(--muted)',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
  },
  stateBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  gameState: {
    color: 'var(--floodlight)',
  },
  connectionText: {
    borderLeft: '1px solid var(--hairline)',
    paddingLeft: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
    gap: 24,
  },
  pulseSection: {
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: 20,
  },
  feedSection: {
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: 20,
    maxHeight: 520,
    overflowY: 'auto',
  },
  sectionLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: 2,
    color: 'var(--muted)',
    margin: '0 0 16px',
  },
  pulsePlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  probRow: {
    display: 'flex',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  probBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  probValue: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: 22,
  },
  probLabel: {
    fontSize: 11,
    color: 'var(--muted)',
    marginTop: 2,
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  feedCard: {
    borderLeft: '2px solid var(--pulse-dim)',
    paddingLeft: 12,
  },
  feedTime: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--muted)',
    marginBottom: 4,
  },
  feedPulse: {
    margin: '0 0 6px',
    fontSize: 14,
    lineHeight: 1.4,
  },
  feedWhy: {
    margin: '0 0 4px',
    fontSize: 12,
    color: 'var(--muted)',
    lineHeight: 1.4,
  },
  feedWhatIf: {
    margin: 0,
    fontSize: 12,
    color: 'var(--muted)',
    lineHeight: 1.4,
  },
  voiceButton: {
    position: 'fixed',
    bottom: 28,
    right: 32,
    background: 'var(--pulse)',
    color: 'var(--floodlight)',
    border: 'none',
    borderRadius: 999,
    padding: '14px 22px',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    letterSpacing: 1,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(255, 68, 51, 0.35)',
  },
};
