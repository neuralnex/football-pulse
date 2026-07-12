
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, RawOddsPayload, NormalizedMatchState } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';
import { FootyPartnerNarrativeEngine } from '@/lib/ai/narrativeEngine';
import { getFixtureById } from '@/lib/txline/fixtures';
import { resolveMatchData } from '@/lib/match/resolveMatchData';
import { getEpochDay } from '@/lib/txline/dates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  const fixture = await getFixtureById(fixtureIdNum);
  if (!fixture) {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
  }

  const homeTeam = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
  const awayTeam = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;

  try {
    // Resolve match data to get odds (works for both live and archive matches)
    const resolved = await resolveMatchData(fixtureIdNum, {
      startTimeMs: fixture.StartTime,
      competition: fixture.Competition ?? 'World Cup',
      homeTeam,
      awayTeam,
      participant1IsHome: fixture.Participant1IsHome ?? true,
      epochDay: fixture.StartTime ? getEpochDay(new Date(fixture.StartTime)) : undefined,
      fetchOdds: true,
    });

    let normalized: NormalizedMatchState | null = null;

    if (resolved.odds) {
      normalized = resolved.odds;
    } else {
      // Fallback: try live odds endpoint
      normalized = await withFreshSession(async (headers) => {
        const oddsResponse = await axios.get<RawOddsPayload[]>(
          `${apiBaseUrl}/odds/updates/${fixtureIdNum}`,
          { headers }
        );
        return TxLineDataParser.parseLiveOdds(oddsResponse.data);
      });
    }

    if (!normalized) {
      return NextResponse.json(
        { error: 'No odds data available for this fixture.' },
        { status: 404 }
      );
    }

    const narrativeEngine = new FootyPartnerNarrativeEngine();
    const narrative = await narrativeEngine.generateNarrative(normalized, homeTeam, awayTeam, {
      currentScore: resolved.latest ? {
        home: resolved.latest.scoreSoccer?.Participant1?.Total?.Goals ?? 0,
        away: resolved.latest.scoreSoccer?.Participant2?.Total?.Goals ?? 0,
      } : undefined,
      stats: resolved.latest?.stats,
    });

    return NextResponse.json({ state: normalized, narrative });
  } catch (err) {
    console.error('[api/fixtures/narrative] failed:', err);
    return NextResponse.json(
      { error: 'Failed to generate narrative for this fixture.' },
      { status: 502 }
    );
  }
}
