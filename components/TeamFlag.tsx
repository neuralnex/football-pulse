'use client';

import { flagImageUrl, teamInitials } from '@/lib/teams/flags';

type TeamFlagSize = 'sm' | 'md' | 'lg' | 'hero';

const SIZE_MAP: Record<TeamFlagSize, { box: string; img: 24 | 40 | 80; text: string }> = {
  sm: { box: 'h-7 w-7 rounded-md', img: 24, text: 'text-[10px]' },
  md: { box: 'h-12 w-12 rounded-xl', img: 40, text: 'text-xs' },
  lg: { box: 'h-[72px] w-[72px] rounded-2xl', img: 80, text: 'text-sm' },
  hero: { box: 'h-20 w-20 rounded-[20px] sm:h-[88px] sm:w-[88px]', img: 80, text: 'text-base' },
};

export default function TeamFlag({
  team,
  size = 'md',
  className = '',
}: {
  team: string;
  size?: TeamFlagSize;
  className?: string;
}) {
  const cfg = SIZE_MAP[size];
  const src = flagImageUrl(team, cfg.img);

  return (
    <div
      className={`team-flag ${cfg.box} flex shrink-0 items-center justify-center overflow-hidden border-2 border-[var(--border)] bg-[var(--surface-light)] ${className}`}
      title={team}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${team} flag`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className={`font-bold text-[var(--text-muted)] ${cfg.text}`}>{teamInitials(team)}</span>
      )}
    </div>
  );
}
