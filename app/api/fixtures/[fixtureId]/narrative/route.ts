
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, RawOddsPayload, NormalizedMatchState } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';
import { FootyPartnerNarrativeEngine } from '@/lib/ai/narrativeEngine';
import { getFixtureById } from '@/lib/txline/fixtures';
import { resolveMatchData } from '@/lib/match/resolveMatchData';
import { getEpochDay } from '@/lib/txline/dates';
import { describeScoreEvent } from '@/lib/txline/gameState';

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

    // Extract detailed match data for narrative
    const latest = resolved.latest;
    const history = resolved.history;
    
    // Build detailed score info
    let scoreDetails: {
      homeGoals: number;
      awayGoals: number;
      homeYellows: number;
      awayYellows: number;
      homeReds: number;
      awayReds: number;
      homeCorners: number;
      awayCorners: number;
    } | undefined;
    
    if (latest?.scoreSoccer) {
      const p1 = latest.scoreSoccer.Participant1?.Total;
      const p2 = latest.scoreSoccer.Participant2?.Total;
      scoreDetails = {
        homeGoals: p1?.Goals ?? 0,
        awayGoals: p2?.Goals ?? 0,
        homeYellows: p1?.YellowCards ?? 0,
        awayYellows: p2?.YellowCards ?? 0,
        homeReds: p1?.RedCards ?? 0,
        awayReds: p2?.RedCards ?? 0,
        homeCorners: p1?.Corners ?? 0,
        awayCorners: p2?.Corners ?? 0,
      };
    }

    // Build detailed stats
    let detailedStats: Record<string, number> | undefined;
    if (latest?.stats && Object.keys(latest.stats).length > 0) {
      detailedStats = latest.stats;
    }

    // Build recent events
    const recentEvents = history
      .slice(-12)
      .map((s) => describeScoreEvent(s))
      .filter(Boolean);

    const narrativeEngine = new FootyPartnerNarrativeEngine();
    const narrative = await narrativeEngine.generateNarrative(normalized, homeTeam, awayTeam, {
      currentScore: latest ? {
        home: latest.scoreSoccer?.Participant1?.Total?.Goals ?? 0,
        away: latest.scoreSoccer?.Participant2?.Total?.Goals ?? 0,
      } : undefined,
      stats: latest?.stats,
      scoreDetails,
      possession: latest?.possession,
      detailedStats,
      recentEvents,
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
