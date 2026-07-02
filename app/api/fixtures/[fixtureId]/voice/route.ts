// app/api/fixtures/[fixtureId]/voice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, RawOddsPayload } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';
import { FootballPulseNarrativeEngine } from '@/lib/ai/narrativeEngine';
import { FootballPulseVoiceEngine } from '@/lib/ai/voiceEngine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('home') ?? 'Home';
  const awayTeam = searchParams.get('away') ?? 'Away';

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  try {
    const normalized = await withFreshSession(async (headers) => {
      const response = await axios.get<RawOddsPayload[]>(
        `${apiBaseUrl}/odds/updates/${fixtureIdNum}`,
        { headers }
      );
      return TxLineDataParser.parseLiveOdds(response.data);
    });

    const narrativeEngine = new FootballPulseNarrativeEngine();
    const narrative = await narrativeEngine.generateNarrative(normalized, homeTeam, awayTeam);

    const voiceEngine = new FootballPulseVoiceEngine();
    const audioBuffer = await voiceEngine.synthesiseLiveBriefing({
      homeTeam,
      awayTeam,
      narrative,
    });

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioBuffer.length),
      },
    });
  } catch (err) {
    console.error('[api/fixtures/voice] failed:', err);
    return NextResponse.json(
      { error: 'Failed to generate voice commentary for this fixture.' },
      { status: 502 }
    );
  }
}
