export interface RawOddsPayload {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  GameState?: string;
  InRunning: boolean;
  MarketParameters?: string;
  MarketPeriod?: string;
  PriceNames?: string[];
  Prices?: number[];
  Pct?: string[];
}

export interface OddsMarketView {
  bookmaker: string;
  marketType: string;
  marketPeriod: string;
  gameState: string;
  inRunning: boolean;
  selections: Array<{ name: string; price: number | null; pct: number | null }>;
  timestamp: number;
}

export interface NormalizedMatchState {
  fixtureId: number;
  timestamp: number;
  gameState: string;
  isLive: boolean;
  bookmaker: string | null;
  probabilities: {
    homeWin: number;
    draw: number;
    awayWin: number;
  } | null;
  markets: OddsMarketView[];
}

const FINISHED_STATES = new Set(['F', 'FET', 'FPE', 'A', 'C', 'TXCC', 'TXCS', 'P', 'END']);
const ACTIVE_STATES = new Set(['H1', 'HT', 'H2', 'WET', 'ET1', 'HTET', 'ET2', 'WPE', 'PE', 'LIVE', 'I']);

function safePct(val: string | undefined): number | null {
  if (!val || val === 'NA') return null;
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMatchWinnerMarket(payload: RawOddsPayload): boolean {
  const names = payload.PriceNames ?? [];
  return names.includes('1') && names.includes('2');
}

function toMarketView(payload: RawOddsPayload): OddsMarketView {
  const names = payload.PriceNames ?? [];
  const prices = payload.Prices ?? [];
  const pcts = payload.Pct ?? [];

  return {
    bookmaker: payload.Bookmaker,
    marketType: payload.SuperOddsType,
    marketPeriod: payload.MarketPeriod ?? '—',
    gameState: payload.GameState ?? '—',
    inRunning: payload.InRunning,
    timestamp: payload.Ts,
    selections: names.map((name, i) => ({
      name,
      price: prices[i] ?? null,
      pct: safePct(pcts[i]),
    })),
  };
}

export class TxLineDataParser {
  public static parseOddsPayloads(payloads: RawOddsPayload[]): NormalizedMatchState {
    if (!payloads?.length) {
      throw new Error('Empty odds payload — nothing to parse.');
    }

    const mainMarket =
      payloads.find((p) => isMatchWinnerMarket(p) && p.InRunning) ??
      payloads.find(isMatchWinnerMarket) ??
      payloads[0];

    let probabilities: NormalizedMatchState['probabilities'] = null;

    if (mainMarket.PriceNames && mainMarket.Pct) {
      const homeIdx = mainMarket.PriceNames.indexOf('1');
      const drawIdx = mainMarket.PriceNames.indexOf('X');
      const awayIdx = mainMarket.PriceNames.indexOf('2');

      probabilities = {
        homeWin: homeIdx !== -1 ? safePct(mainMarket.Pct[homeIdx]) ?? 0 : 0,
        draw: drawIdx !== -1 ? safePct(mainMarket.Pct[drawIdx]) ?? 0 : 0,
        awayWin: awayIdx !== -1 ? safePct(mainMarket.Pct[awayIdx]) ?? 0 : 0,
      };
    }

    const gameState = (mainMarket.GameState || 'NS').toUpperCase();
    const isLive = FINISHED_STATES.has(gameState)
      ? false
      : mainMarket.InRunning || ACTIVE_STATES.has(gameState);

    const markets = payloads
      .filter(isMatchWinnerMarket)
      .slice(0, 5)
      .map(toMarketView);

    return {
      fixtureId: mainMarket.FixtureId,
      timestamp: mainMarket.Ts,
      gameState: mainMarket.GameState || 'NS',
      isLive,
      bookmaker: mainMarket.Bookmaker ?? null,
      probabilities,
      markets,
    };
  }

  public static parseLiveOdds(payloads: RawOddsPayload[]): NormalizedMatchState {
    return TxLineDataParser.parseOddsPayloads(payloads);
  }
}
