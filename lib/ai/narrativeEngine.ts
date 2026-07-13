
import { GoogleGenAI } from '@google/genai';
import { NormalizedMatchState } from '../txline/parser';

const SYSTEM_INSTRUCTION = `
ROLE & MISSION:
You are FootyPartner, a passionate football companion and analyst. Turn match-state
data (score, minute, odds, stats, events) into plain-English stories for casual fans.
You are NOT a neutral reporter — you take a view, argue a point, and explain the game
like a knowledgeable friend watching with the user.

For each update, cover:
1. What happened (plain English translation of the state/odds shift)
2. Why it happened (tactical or structural cause, if inferable — argue your case)
3. Why it matters (impact on World Cup group standings, qualification, elimination, or legacy)

Never invent scoreline or event details not present in the provided data.
If the data doesn't support a claim, say the data doesn't show it rather than guessing.

OUTPUT PILLARS:
- Match summary: 1-2 short, emotionally engaging sentences with a clear viewpoint.
- Why It Matters: 1-2 sentences on tournament-level stakes or what this means for the teams.
- What-If: one short hypothetical framed around the current probability shift — argue a plausible scenario.
`.trim();

export interface NarrativeOutput {
  matchPulse: string;
  whyItMatters: string;
  whatIf: string;
}

export class FootyPartnerNarrativeEngine {
  private client: GoogleGenAI;
  private model = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing from server env vars.');
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  public async generateNarrative(
    state: NormalizedMatchState,
    homeTeam: string,
    awayTeam: string,
    matchData?: {
      currentScore?: { home: number; away: number };
      stats?: any;
      scoreDetails?: {
        homeGoals: number;
        awayGoals: number;
        homeYellows: number;
        awayYellows: number;
        homeReds: number;
        awayReds: number;
        homeCorners: number;
        awayCorners: number;
      };
      possession?: number;
      detailedStats?: Record<string, number>;
      recentEvents?: string[];
    }
  ): Promise<NarrativeOutput> {
    const scoreInfo = matchData?.currentScore
      ? `Current score: ${homeTeam} ${matchData.currentScore.home} - ${matchData.currentScore.away} ${awayTeam}`
      : 'Current score: not available';

    // Build detailed score info
    let detailedScoreInfo = '';
    if (matchData?.scoreDetails) {
      const d = matchData.scoreDetails;
      detailedScoreInfo = `Match details — ${homeTeam}: ${d.homeGoals} goals, ${d.homeYellows} yellow, ${d.homeReds} red, ${d.homeCorners} corners | ${awayTeam}: ${d.awayGoals} goals, ${d.awayYellows} yellow, ${d.awayReds} red, ${d.awayCorners} corners`;
    }

    // Build stats info
    let statsInfo = '';
    if (matchData?.possession !== undefined) {
      statsInfo += `Possession: ${matchData.possession}% ${homeTeam} / ${100 - matchData.possession}% ${awayTeam}`;
    }
    if (matchData?.detailedStats && Object.keys(matchData.detailedStats).length > 0) {
      const statLabels: Record<string, string> = {
        shots: 'Shots',
        shotsOnTarget: 'Shots on Target',
        passes: 'Passes',
        passAccuracy: 'Pass Accuracy %',
        tackles: 'Tackles',
        interceptions: 'Interceptions',
        fouls: 'Fouls',
        offsides: 'Offsides',
        corners: 'Corners',
        yellow: 'Yellow Cards',
        red: 'Red Cards'
      };
      const statEntries = Object.entries(matchData.detailedStats)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => `${statLabels[key] || key}: ${value}`)
        .slice(0, 8);
      if (statEntries.length > 0) {
        statsInfo += (statsInfo ? ' | ' : '') + `Stats: ${statEntries.join(', ')}`;
      }
    }

    // Build events info
    let eventsInfo = '';
    if (matchData?.recentEvents && matchData.recentEvents.length > 0) {
      eventsInfo = `Recent events: ${matchData.recentEvents.slice(-5).join('; ')}`;
    }

    const prompt = `
Match: ${homeTeam} vs ${awayTeam}
Fixture ID: ${state.fixtureId}
Game state: ${state.gameState}
Live: ${state.isLive}
${scoreInfo}
${detailedScoreInfo}
${statsInfo}
${eventsInfo}
Win probabilities: ${
      state.probabilities
        ? `${homeTeam} ${state.probabilities.homeWin}% | Draw ${state.probabilities.draw}% | ${awayTeam} ${state.probabilities.awayWin}%`
        : 'not available for this update'
    }

Respond ONLY with strict JSON matching this shape, no markdown fences:
{"matchPulse": string, "whyItMatters": string, "whatIf": string}
`.trim();

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const text = response.text ?? '';
    const clean = text.replace(/```json|```/g, '').trim();

    try {
      return JSON.parse(clean) as NarrativeOutput;
    } catch (err) {
      throw new Error(`Failed to parse Gemini narrative response as JSON: ${clean}`);
    }
  }
}
