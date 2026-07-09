import { NextRequest, NextResponse } from 'next/server';
import { getOddsSnapshot, getOddsUpdates } from '@/lib/txline/odds';
import { TxLineDataParser } from '@/lib/txline/parser';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') ?? 'updates';

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  try {
    const payloads =
      source === 'snapshot'
        ? await getOddsSnapshot(fixtureIdNum)
        : await getOddsUpdates(fixtureIdNum);

    if (!payloads?.length) {
      return NextResponse.json({
        fixtureId: fixtureIdNum,
        gameState: 'NS',
        isLive: false,
        bookmaker: null,
        probabilities: null,
        markets: [],
        raw: [],
      });
    }

    const normalized = TxLineDataParser.parseOddsPayloads(payloads);
    return NextResponse.json({ ...normalized, raw: payloads });
  } catch (err) {
    console.error('[api/fixtures/odds] failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch or parse odds from TxLINE.' },
      { status: 502 }
    );
  }
}
