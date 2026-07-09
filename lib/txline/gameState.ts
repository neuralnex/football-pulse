import type { ScoreSnapshot } from './scores';

const LIVE_STATES = new Set([
  'H1',
  'HT',
  'H2',
  'WET',
  'ET1',
  'HTET',
  'ET2',
  'WPE',
  'PE',
  'I',
  'LIVE',
  'IN_PLAY',
]);

const FINISHED_STATES = new Set([
  'F',
  'FET',
  'FPE',
  'END',
  'A',
  'C',
  'TXCC',
  'TXCS',
  'P',
  'WO',
]);

const PREMATCH_STATES = new Set(['NS', 'PRE_MATCH', 'PREMATCH']);

const STATE_LABELS: Record<string, string> = {
  NS: 'Not started',
  H1: '1st half',
  HT: 'Half time',
  H2: '2nd half',
  F: 'Full time',
  END: 'Full time',
  WET: 'Waiting for ET',
  ET1: 'ET 1st half',
  HTET: 'ET half time',
  ET2: 'ET 2nd half',
  FET: 'After extra time',
  WPE: 'Waiting for pens',
  PE: 'Penalties',
  FPE: 'After penalties',
  I: 'Interrupted',
  A: 'Abandoned',
  C: 'Cancelled',
  P: 'Postponed',
  TXCC: 'Coverage cancelled',
  TXCS: 'Coverage suspended',
};

export function isSoccerLive(gameState?: string | null): boolean {
  if (!gameState) return false;
  const normalized = gameState.toUpperCase();
  if (FINISHED_STATES.has(normalized)) return false;
  if (PREMATCH_STATES.has(normalized)) return false;
  return LIVE_STATES.has(normalized);
}

export function isSoccerFinished(gameState?: string | null): boolean {
  if (!gameState) return false;
  return FINISHED_STATES.has(gameState.toUpperCase());
}

export function formatGameState(gameState?: string | null): string {
  if (!gameState) return '—';
  return STATE_LABELS[gameState.toUpperCase()] ?? gameState;
}

export function formatMatchMinute(score?: ScoreSnapshot | null): string {
  if (!score) return "0'";
  const minutes = score.dataSoccer?.Minutes;
  if (typeof minutes === 'number' && minutes >= 0) return `${minutes}'`;
  const state = score.gameState?.toUpperCase();
  if (state === 'HT' || state === 'HTET') return 'HT';
  if (state === 'PE') return 'Pens';
  if (isSoccerFinished(state)) return 'FT';
  if (PREMATCH_STATES.has(state ?? '')) return '—';
  return "—";
}

export function describeScoreEvent(score: ScoreSnapshot): string {
  const data = score.dataSoccer;
  if (!data) return score.action || 'Match update';

  if (data.Goal) {
    const type = data.GoalType ? ` (${String(data.GoalType)})` : '';
    return `Goal${type}`;
  }
  if (data.RedCard) return 'Red card';
  if (data.YellowCard) return 'Yellow card';
  if (data.Corner) return 'Corner';
  if (data.Penalty) return 'Penalty';
  if (data.VAR) return 'VAR check';
  if (data.Action) return data.Action;
  if (data.Type) return data.Type;
  return score.action || 'Match event';
}

import type { PlayerLineupData } from './scores';

export function extractLineups(score?: ScoreSnapshot | null): {
  home: PlayerLineupData[];
  away: PlayerLineupData[];
} {
  const empty = { home: [] as PlayerLineupData[], away: [] as PlayerLineupData[] };
  if (!score?.lineups || score.lineups.length === 0) return empty;

  const [first, second] = score.lineups;
  if (score.participant1IsHome) {
    return {
      home: first?.lineups ?? [],
      away: second?.lineups ?? [],
    };
  }
  return {
    home: second?.lineups ?? [],
    away: first?.lineups ?? [],
  };
}

export function scoreFromSnapshot(score?: ScoreSnapshot | null) {
  if (!score?.scoreSoccer) {
    return { home: 0, away: 0, homeYellows: 0, awayYellows: 0, homeReds: 0, awayReds: 0, homeCorners: 0, awayCorners: 0 };
  }
  const p1 = score.scoreSoccer.Participant1.Total;
  const p2 = score.scoreSoccer.Participant2.Total;
  return {
    home: p1?.Goals ?? 0,
    away: p2?.Goals ?? 0,
    homeYellows: p1?.YellowCards ?? 0,
    awayYellows: p2?.YellowCards ?? 0,
    homeReds: p1?.RedCards ?? 0,
    awayReds: p2?.RedCards ?? 0,
    homeCorners: p1?.Corners ?? 0,
    awayCorners: p2?.Corners ?? 0,
  };
}
