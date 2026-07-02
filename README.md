# Football Pulse — Next.js Server + Frontend

Full Next.js 15 (App Router) app for the TxLINE World Cup hackathon
integration: on-chain custodial subscription, live odds streaming, a
Gemini-generated narrative feed, voice commentary, and a dashboard UI
built around the product's own "pulse" metaphor.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in SOLANA_MASTER_PRIVATE_KEY (base58, devnet-funded) and GEMINI_API_KEY
npm run dev
```

Visit `/` for the matchboard, or go straight to
`/fixture/500001?home=Argentina&away=Nigeria`.

Server boots the TxLINE custodian pipeline once at startup via
`instrumentation.ts` (subscribe on-chain → activate API token), cached in
`lib/txline/singleton.ts`. A 20-minute background timer refreshes the
JWT/API token without re-subscribing on-chain (re-subscribing an already
active account hits the IDL's `ActiveSubscription` error) — and every
TxLINE call is wrapped in `withFreshSession()`, which retries once on a
401/403 by force-refreshing. This is specifically to survive a token
expiring mid-demo without the app visibly breaking.

## Routes

| Route | Description |
|---|---|
| `GET /api/health` | Liveness check |
| `GET /api/fixtures/[fixtureId]/odds` | Live odds for a fixture, normalized |
| `GET /api/fixtures/[fixtureId]/narrative?home=X&away=Y` | Odds + Gemini narrative pillars |
| `GET /api/fixtures/[fixtureId]/stream?home=X&away=Y` | **SSE** — pushes odds + narrative every 8s, no client polling |
| `GET /api/fixtures/[fixtureId]/voice?home=X&away=Y` | Synthesizes the Kore/Puck voice script to audio/wav — **unverified SDK shape, see below** |
| `/fixture/[fixtureId]?home=X&away=Y` | The dashboard page: live Pulse Meter, Smart Feed, voice button |

## The frontend

Built around a literal "pulse/vital-sign" visual language rather than a
generic dashboard: a glowing ECG-style line for win probability (the
Pulse Meter), a broadcast-style score bug header, a Smart Feed ticker of
narrative cards, and a floating "● ON AIR" button for voice commentary.
Palette is a pitch-at-night dark green/black with a crimson pulse accent
and muted gold for stakes — deliberately not the generic
dark-background-neon-accent look. All in `app/globals.css` and
`app/fixture/[fixtureId]/FixtureDashboard.tsx`.

## What's verified vs. inferred

**Verified** live against `txline-docs.txodds.com` and the IDL you provided:
- Devnet program ID (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) and TxL mint (`4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG`)
- Devnet API origin (`https://txline-dev.txodds.com`) used consistently for auth/purchase/activation
- `subscribe(service_level_id: u16, weeks: u8)` full account context, Token-2022 program
- Activation signing message is colon-delimited: `${txSig}:${leagues}:${jwt}`
- **Service level 1 confirmed as the World Cup free tier** (per your confirmation)

**Still unverified — confirm before relying on in production:**
- Exact response shape of `GET /api/odds/updates/{fixtureId}` (`lib/txline/parser.ts` is a best-effort adapter, not a confirmed live response — the SSE stream will surface an `error` event if this is wrong rather than crashing)
- **Voice/TTS SDK shape**: while building this, TypeScript caught that the installed `@google/genai` types have no `multiSpeakerVoiceConfig` field at all — only single-speaker `voiceConfig`. I cast around it to unblock compilation (`lib/ai/voiceEngine.ts`), but the dual-speaker Kore/Puck output is genuinely unverified and may need a different SDK version, method, or raw REST call. Don't assume `/voice` works just because it builds — test it before demoing.
- `/api/scores/stat-validation` (merkle proof "Verified Truth" feature) — not built; the trimmed IDL doesn't include `validate_stat`'s dependencies beyond what's already there for reference.

## Security

`SOLANA_MASTER_PRIVATE_KEY` is a custodial signing key — server env vars /
secrets manager only, never in a repo, client bundle, or log line. Fine for a
devnet hackathon demo; consider a KMS-backed signer before any mainnet use
with real funds.

## What's still open (priority order for the remaining hackathon time)

1. **Test `/voice` against a live Gemini call** — the one piece I flagged as genuinely uncertain rather than just unverified.
2. **Confirm the odds response schema** against a real API call, then double check `parser.ts` field mapping.
3. **Real fixtures list** — `app/page.tsx` currently hardcodes two demo fixture IDs since there's no confirmed "list fixtures" endpoint yet.
4. **Verified Truth pillar** (merkle proof validation) — the one feature from your original blueprint not yet built at all.

