// app/api/fixtures/[fixtureId]/odds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, RawOddsPayload } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  try {
    const normalized = await withFreshSession(async (headers) => {
      // UNVERIFIED endpoint path/shape — see lib/txline/parser.ts header note.
      const response = await axios.get<RawOddsPayload[]>(
        `${apiBaseUrl}/odds/updates/${fixtureIdNum}`,
        { headers }
      );
      return TxLineDataParser.parseLiveOdds(response.data);
    });

    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[api/fixtures/odds] failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch or parse live odds from TxLINE.' },
      { status: 502 }
    );
  }
}
