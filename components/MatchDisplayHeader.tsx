'use client';

import type { ReactNode } from 'react';
import TeamFlag from '@/components/TeamFlag';

export interface MatchDisplayHeaderProps {
  homeTeam: string;
  awayTeam: string;
  competition?: string;
  scoreHome?: number | null;
  scoreAway?: number | null;
  isLive?: boolean;
  isPulse?: boolean;
  minute?: string;
  statusLabel?: string;
  kickoffLabel?: string;
  footerNote?: string;
  href?: string;
  className?: string;
  children?: ReactNode;
}

export default function MatchDisplayHeader({
  homeTeam,
  awayTeam,
  competition = 'FIFA World Cup 2026',
  scoreHome,
  scoreAway,
  isLive = false,
  isPulse = false,
  minute,
  statusLabel,
  kickoffLabel,
  footerNote,
  href,
  className = '',
  children,
}: MatchDisplayHeaderProps) {
  const hasScore = scoreHome != null && scoreAway != null;
  const live = isLive || isPulse;

  const body = (
    <>
      <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium text-[var(--text-muted)]">
        🏆 {competition}
      </div>

      {live ? (
        <span className="live-badge mx-auto mb-4 flex w-fit">
          <span className="live-dot" />
          Live{minute ? ` · ${minute}` : ''}
        </span>
      ) : statusLabel ? (
        <p className="mb-4 text-xs uppercase tracking-widest text-[var(--text-muted)]">{statusLabel}</p>
      ) : (
        <div className="mb-4 h-4" />
      )}

      <div className="flex items-center justify-center gap-6 sm:gap-10">
        <div className="flex flex-col items-center gap-3">
          <TeamFlag team={homeTeam} size="lg" />
          <span className="text-center text-base font-bold sm:text-lg">{homeTeam}</span>
        </div>

        <div className="text-center">
          <div
            className={`text-4xl font-black tabular-nums tracking-wider sm:text-5xl ${
              live ? 'text-[var(--accent)]' : 'text-[var(--text)]'
            }`}
            style={live ? { textShadow: '0 0 20px var(--accent-glow)' } : undefined}
          >
            {hasScore ? `${scoreHome} - ${scoreAway}` : kickoffLabel ? 'VS' : '– - –'}
          </div>
          {live && minute ? (
            <p className="mt-2 flex items-center justify-center gap-2 text-sm font-bold text-[var(--accent)]">
              <span className="live-dot" />
              {minute}
            </p>
          ) : kickoffLabel ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">{kickoffLabel}</p>
          ) : minute ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">{minute}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-3">
          <TeamFlag team={awayTeam} size="lg" />
          <span className="text-center text-base font-bold sm:text-lg">{awayTeam}</span>
        </div>
      </div>

      {footerNote && (
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">{footerNote}</p>
      )}

      {children}
    </>
  );

  const classes = [
    'detail-header',
    href ? 'detail-header-link' : '',
    live ? 'detail-header-live' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <a href={href} className={classes}>
        {body}
      </a>
    );
  }

  return <header className={classes}>{body}</header>;
}
