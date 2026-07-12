import { GoogleGenAI } from '@google/genai';
import type { NormalizedMatchState } from '../txline/parser';
import type { ScoreSnapshot } from '../txline/scores';
import { formatMatchEndLabel, formatMatchMinute, scoreFromSnapshot } from '../txline/gameState';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MatchChatContext {
  homeTeam: string;
  awayTeam: string;
  fixtureId: number;
  latestScore?: ScoreSnapshot | null;
  odds?: NormalizedMatchState | null;
  recentEvents?: string[];
}

const SYSTEM_INSTRUCTION = `
You are FootyPartner, a passionate football companion and analyst for casual fans.
You explain the game in plain English and you are NOT afraid to argue a point, take a side,
or debate tactics, refereeing decisions, team selections, and turning points.

Use ONLY the match context provided (score, minute/phase, win probabilities, recent events,
stats, lineups). Never invent goals, cards, substitutions, or events that are not in the context.
If the data doesn't support a claim, say so plainly rather than guessing.

How to behave:
- Be conversational, opinionated, and warm — like a knowledgeable friend watching the match with the user.
- When the user asks "why", explain the tactical or structural cause in simple terms.
- When the user asks "what if", argue a plausible scenario based on the current state.
- For archive/finished matches, recap the key moments, debate what decided the result, and argue
  about how the teams could have approached it differently.
- Keep replies tight (2-5 sentences) unless the user asks for depth. No betting jargon unless asked.
- If you lack data, tell the user what you do know and what is still missing.
`.trim();

export class FootyPartnerChatEngine {
  private client: GoogleGenAI;
  private model = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing from server env vars.');
    this.client = new GoogleGenAI({ apiKey });
  }

  private buildContextBlock(ctx: MatchChatContext): string {
    const score = scoreFromSnapshot(ctx.latestScore);
    const minute = formatMatchMinute(ctx.latestScore);
    const state = formatMatchEndLabel(ctx.latestScore);

    const scoreLine = score
      ? `Score: ${ctx.homeTeam} ${score.home} - ${score.away} ${ctx.awayTeam}`
      : 'Score: not available yet';

    const probs = ctx.odds?.probabilities
      ? `Win chance — ${ctx.homeTeam} ${ctx.odds.probabilities.homeWin}%, Draw ${ctx.odds.probabilities.draw}%, ${ctx.awayTeam} ${ctx.odds.probabilities.awayWin}%`
      : 'Win probabilities: not available yet';

    const events =
      ctx.recentEvents && ctx.recentEvents.length > 0
        ? `Recent events:\n${ctx.recentEvents.map((e) => `- ${e}`).join('\n')}`
        : 'Recent events: none logged yet';

    return `
Match: ${ctx.homeTeam} vs ${ctx.awayTeam}
Fixture ID: ${ctx.fixtureId}
${scoreLine}
Minute / phase: ${minute || 'pending'}${state ? ` (${state})` : ''}
${probs}
${events}
`.trim();
  }

  async reply(messages: ChatMessage[], ctx: MatchChatContext): Promise<string> {
    const contextBlock = this.buildContextBlock(ctx);
    const history = messages
      .slice(-10)
      .map((m) => `${m.role === 'user' ? 'Fan' : 'FootyPartner'}: ${m.content}`)
      .join('\n');

    const prompt = `
MATCH CONTEXT (authoritative — do not contradict):
${contextBlock}

CONVERSATION:
${history}

Respond as FootyPartner to the Fan's latest message. Plain text only, no JSON.
`.trim();

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    return (response.text ?? '').trim() || "I'm still syncing live data — try again in a moment.";
  }
}
