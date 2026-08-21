import type { ConnectorResult } from '../../domain/connectors/access-carrier.connector';

/** Таймаут одного обращения к площадке. */
export const CARRIER_HTTP_TIMEOUT_MS = 15_000;

export interface HttpCallResult {
  ok: boolean;
  status: number;
  body: unknown;
  text: string;
}

/**
 * Общее для HTTP-площадок: таймаут, сетевые ошибки как `retryable`,
 * 5xx/429 — `retryable`, 4xx — `fatal`. Конкретные коды «уже существует» и
 * «лимит лицензии» распознаёт сам коннектор.
 */
export async function httpCall(url: string, init: RequestInit): Promise<HttpCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CARRIER_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

export function classifyHttpFailure(e: unknown): ConnectorResult {
  const message = e instanceof Error ? e.message : String(e);
  return { code: 'retryable', message: `Площадка недоступна: ${message}` };
}

export function classifyStatus(status: number, text: string): ConnectorResult {
  if (status === 429 || status >= 500) return { code: 'retryable', message: `HTTP ${status}: ${text.slice(0, 200)}` };
  return { code: 'fatal', message: `HTTP ${status}: ${text.slice(0, 200)}` };
}
