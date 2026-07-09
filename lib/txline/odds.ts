import { withFreshSession } from '@/lib/txline/singleton';
import { apiBaseUrl } from '@/lib/txline/config';
import type { RawOddsPayload } from '@/lib/txline/parser';
import { txlineCache } from '@/lib/infra/ttlCache';
import { LOAD_CONFIG } from '@/lib/infra/loadConfig';
import { txlineHttp } from '@/lib/txline/http';

export async function getOddsSnapshot(fixtureId: number, asOf?: number) {
  const key = `odds:snapshot:${fixtureId}:${asOf ?? 'live'}`;
  return txlineCache.getOrSet(key, LOAD_CONFIG.cache.oddsSnapshot, () =>
    fetchOddsSnapshot(fixtureId, asOf)
  );
}

async function fetchOddsSnapshot(fixtureId: number, asOf?: number) {
  const queryParams = new URLSearchParams();
  if (asOf !== undefined) queryParams.set('asOf', String(asOf));

  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/odds/snapshot/${fixtureId}${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    const response = await txlineHttp.get<RawOddsPayload[]>(url, { headers });
    return response.data;
  });
}

export async function getOddsUpdates(fixtureId: number) {
  const key = `odds:updates:${fixtureId}`;
  return txlineCache.getOrSet(key, LOAD_CONFIG.cache.oddsUpdates, () =>
    fetchOddsUpdates(fixtureId)
  );
}

async function fetchOddsUpdates(fixtureId: number) {
  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/odds/updates/${fixtureId}`;
    const response = await txlineHttp.get<RawOddsPayload[]>(url, { headers });
    return response.data;
  });
}
