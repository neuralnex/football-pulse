// lib/ai/voiceEngine.ts
//
// UNVERIFIED SDK SHAPE: I have not checked Google's current TTS API surface
// live in this session. The method/model names below follow the pattern
// from your original draft (multi-speaker `gemini-2.5-flash-preview-tts`),
// but @google/genai's exact call shape for multi-speaker audio output
// changes over time. If this throws a "method not found" or schema error,
// check https://ai.google.dev/gemini-api/docs/speech-generation before
// debugging further — don't assume the bug is elsewhere.

import { GoogleGenAI } from '@google/genai';
import { NarrativeOutput } from './narrativeEngine';

export interface DialogueContext {
  homeTeam: string;
  awayTeam: string;
  narrative: NarrativeOutput;
}

export class FootballPulseVoiceEngine {
  private client: GoogleGenAI;
  private model = 'gemini-2.5-flash-preview-tts';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing from server env vars.');
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Synthesizes the voiceScript pillar (already Kore/Puck-formatted text
   * from the narrative engine) into audio. Returns raw audio bytes —
   * caller decides format/streaming.
   */
  public async synthesiseLiveBriefing(context: DialogueContext): Promise<Buffer> {
    // TYPE MISMATCH CONFIRMED: the installed @google/genai types only define
    // `SpeechConfig.voiceConfig` (single speaker) — there is no
    // multiSpeakerVoiceConfig field in this SDK version's types. This may
    // mean multi-speaker TTS needs a different/newer package version, a
    // different method, or a raw REST call instead of this SDK. Casting to
    // `any` to unblock compilation, but treat Kore/Puck dual-speaker output
    // as UNVERIFIED until checked against current Gemini TTS docs — don't
    // assume this runs correctly just because it compiles.
    const config: any = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: 'Kore', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            { speaker: 'Puck', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          ],
        },
      },
    };

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: context.narrative.voiceScript,
      config,
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.data
    ) as any;

    if (!audioPart?.inlineData?.data) {
      throw new Error(
        'TTS response contained no audio data — check the Gemini TTS docs, ' +
        'the response shape may have changed.'
      );
    }

    return Buffer.from(audioPart.inlineData.data, 'base64');
  }
}
