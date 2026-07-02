// instrumentation.ts (project root)
//
// Next.js calls register() once when the server process starts, before
// it accepts requests. We use it to boot the TxLINE custodian pipeline
// eagerly so the first real request isn't stuck waiting on an on-chain
// transaction. If this fails, requests will retry via lib/txline/singleton.ts
// on demand instead of crashing the whole server.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { getCustodian } = await import('./lib/txline/singleton');
      await getCustodian();
      console.log('[instrumentation] TxLINE custodian pipeline warmed up.');
    } catch (err) {
      console.error(
        '[instrumentation] Custodian warm-up failed — will retry lazily on first request:',
        err
      );
    }
  }
}
