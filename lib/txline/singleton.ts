// lib/txline/singleton.ts
//
// Next.js dev mode hot-reloads modules per request, which would otherwise
// re-instantiate the custodian (and re-run the on-chain subscribe tx) on
// every file save. Cache it on globalThis, same pattern Prisma/DB clients
// use in Next.js, to survive hot reloads.
//
// Also runs a background refresh timer: JWTs are typically short-lived
// (docs don't state an exact TTL), so for a live hackathon demo it's safer
// to proactively refresh every 20 minutes than to find out mid-demo that a
// request 401'd. Refresh re-activates against the existing subscribe tx —
// it does not resubmit an on-chain transaction.

import { TxLineCustodianEngine } from './custodian';

const REFRESH_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

declare global {
  // eslint-disable-next-line no-var
  var __txlineCustodian: TxLineCustodianEngine | undefined;
  // eslint-disable-next-line no-var
  var __txlineBootPromise: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __txlineRefreshTimer: ReturnType<typeof setInterval> | undefined;
}

export async function getCustodian(): Promise<TxLineCustodianEngine> {
  if (!globalThis.__txlineCustodian) {
    globalThis.__txlineCustodian = new TxLineCustodianEngine();
  }

  if (!globalThis.__txlineBootPromise) {
    globalThis.__txlineBootPromise = globalThis.__txlineCustodian
      .bootCustodianPipeline()
      .then(() => {
        startRefreshTimer();
      });
  }

  await globalThis.__txlineBootPromise;
  return globalThis.__txlineCustodian;
}

function startRefreshTimer() {
  if (globalThis.__txlineRefreshTimer) return;
  globalThis.__txlineRefreshTimer = setInterval(async () => {
    try {
      await globalThis.__txlineCustodian?.refreshCredentials();
      console.log('[txline] credentials refreshed on schedule.');
    } catch (err) {
      console.error('[txline] scheduled refresh failed, will retry next interval:', err);
    }
  }, REFRESH_INTERVAL_MS);
}

/**
 * Wrap any TxLINE API call with this — if it 401s, refreshes credentials
 * once and retries. Keeps a live demo alive even if the timer hasn't
 * fired yet.
 */
export async function withFreshSession<T>(
  fn: (headers: Record<string, string>) => Promise<T>
): Promise<T> {
  const custodian = await getCustodian();
  try {
    return await fn(custodian.getSessionHeaders());
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      console.warn('[txline] session rejected, refreshing and retrying once...');
      await custodian.refreshCredentials();
      return fn(custodian.getSessionHeaders());
    }
    throw err;
  }
}
