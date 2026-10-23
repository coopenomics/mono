/**
 * @fileoverview HTTP-импл `HealthProbePort`. Поллит target URL до 200 OK
 * или таймаута.
 *
 * Без зависимостей: используем встроенный `fetch` (Node 20+).
 *
 * Между попытками — backoff 500ms. На каждой попытке timeout запроса
 * 2 сек, чтоб не залипать на slow-DNS / hanging connect'е.
 */
import { Injectable } from '@nestjs/common';
import { HealthOutcome, HealthProbePort } from './ports';

const POLL_INTERVAL_MS = 500;
const REQUEST_TIMEOUT_MS = 2_000;

@Injectable()
export class HttpHealthProbe implements HealthProbePort {
  async waitUntilHealthy(opts: { url: string; timeoutMs: number }): Promise<HealthOutcome> {
    const start = Date.now();
    let lastError: string | undefined;
    let lastReason: 'timeout' | 'badStatus' | 'transportError' = 'timeout';

    while (Date.now() - start < opts.timeoutMs) {
      const probe = await this.singleProbe(opts.url);
      if (probe.ok) {
        return { ok: true, elapsedMs: Date.now() - start };
      }
      lastReason = probe.reason;
      lastError = probe.error;
      await sleep(POLL_INTERVAL_MS);
    }
    return { ok: false, reason: lastReason, lastError };
  }

  private async singleProbe(url: string): Promise<
    { ok: true } | { ok: false; reason: 'badStatus' | 'transportError'; error: string }
  > {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        const resp = await fetch(url, { method: 'GET', signal: ctrl.signal });
        if (resp.status >= 200 && resp.status < 300) {
          return { ok: true };
        }
        return { ok: false, reason: 'badStatus', error: `HTTP ${resp.status}` };
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      return {
        ok: false,
        reason: 'transportError',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
