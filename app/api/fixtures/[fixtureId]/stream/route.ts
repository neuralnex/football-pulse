// app/api/fixtures/[fixtureId]/stream/route.ts
//
// Server-Sent Events endpoint: pushes a fresh odds+narrative update every
// POLL_INTERVAL_MS while the client tab stays open, instead of the client
// polling on its own. This is what makes the frontend feel "live" rather
// than a page you have to refresh — worth having for the demo even before
// the odds schema is fully nailed down, since it degrades gracefully:
// a schema mismatch just shows up as an `error` event in the stream.

import { NextRequest } from 'next/server';
import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, RawOddsPayload } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';
import { FootballPulseNarrativeEngine } from '@/lib/ai/narrativeEngine';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 8000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('home') ?? 'Home';
  const awayTeam = searchParams.get('away') ?? 'Away';
  const withNarrative = searchParams.get('narrative') !== 'false';

  if (!Number.isFinite(fixtureIdNum)) {
    return new Response('fixtureId must be numeric', { status: 400 });
  }

  const encoder = new TextEncoder();
  let narrativeEngine: FootballPulseNarrativeEngine | null = null;
  try {
    if (withNarrative) narrativeEngine = new FootballPulseNarrativeEngine();
  } catch {
    // GEMINI_API_KEY missing — stream odds only, skip narrative silently.
  }

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const tick = async () => {
        try {
          const normalized = await withFreshSession(async (headers) => {
            const response = await axios.get<RawOddsPayload[]>(
              `${apiBaseUrl}/odds/updates/${fixtureIdNum}`,
              { headers }
            );
            return TxLineDataParser.parseLiveOdds(response.data);
          });

          send('odds', normalized);

          if (narrativeEngine) {
            try {
              const narrative = await narrativeEngine.generateNarrative(
                normalized,
                homeTeam,
                awayTeam
              );
              send('narrative', narrative);
            } catch (narrativeErr) {
              send('error', { source: 'narrative', message: String(narrativeErr) });
            }
          }
        } catch (err) {
          send('error', { source: 'odds', message: String(err) });
        }
      };

      // Fire immediately, then on interval.
      tick();
      const interval = setInterval(tick, POLL_INTERVAL_MS);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
