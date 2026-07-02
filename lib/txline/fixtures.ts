import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { apiBaseUrl } from '@/lib/txline/config';

export interface FixtureSnapshot {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
}

export interface FixtureSnapshotQuery {
  startEpochDay?: number;
  competitionId?: number;
}

export async function getFixtureSnapshot(query: FixtureSnapshotQuery = {}) {
  const queryParams = new URLSearchParams();
  if (query.startEpochDay !== undefined) {
    queryParams.set('startEpochDay', String(query.startEpochDay));
  }
  if (query.competitionId !== undefined) {
    queryParams.set('competitionId', String(query.competitionId));
  }

  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/fixtures/snapshot${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await axios.get<FixtureSnapshot[]>(url, { headers });
    return response.data;
  });
}

export async function getFixtureById(fixtureId: number) {
  const fixtures = await getFixtureSnapshot();
  return fixtures.find((fixture) => fixture.FixtureId === fixtureId) ?? null;
}
