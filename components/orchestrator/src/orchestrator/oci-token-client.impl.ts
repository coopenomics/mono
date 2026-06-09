/**
 * @fileoverview HTTP-импл `OciTokenClientPort`. Идёт за bearer-токеном
 * в CA-auth по протоколу Docker Registry v2 token endpoint (Story 10.6).
 *
 * Эндпоинт: `GET {CA_AUTH_BASE}/v2/token?service=registry&scope=repository:<packageId>:pull`
 * Авторизация: `Authorization: Bearer <cooperativeJwt>` — это JWT
 * кооператива, выданный CA-auth при онбординге; CA-auth маппит
 * coopname → discharge OCI token со scope'ом pull.
 *
 * Ответ: `{ token: "..." }` — короткоживущий (15 мин); docker pull
 * подставляет его как Bearer на каждом запросе к registry.
 */
import { Injectable } from '@nestjs/common';
import { OciTokenClientPort } from './ports';

const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class CaAuthOciTokenClient implements OciTokenClientPort {
  constructor(private readonly caAuthBase: string) {}

  async issueToken(opts: { packageId: string; jwt: string }): Promise<string> {
    const scope = `repository:${opts.packageId}:pull`;
    const url = `${this.caAuthBase}/v2/token?service=registry&scope=${encodeURIComponent(scope)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${opts.jwt}` },
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        throw new Error(`CA-auth /v2/token → HTTP ${resp.status}`);
      }
      const body = (await resp.json()) as { token?: string };
      if (typeof body.token !== 'string' || body.token.length === 0) {
        throw new Error('CA-auth /v2/token: пустой token в ответе');
      }
      return body.token;
    } finally {
      clearTimeout(timer);
    }
  }
}
