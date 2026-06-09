/**
 * @fileoverview HTTP-импл `OciTokenClientPort`. Preflight-обмен per-package
 * JWT на OCI access_token по протоколу Docker Registry v2 token endpoint
 * (Story 10.6, ca-auth).
 *
 * Контракт ca-auth (`oci-token.controller.ts`):
 * `GET {CA_AUTH_BASE}/v2/auth/token?service=ca-auth&scope=repository:<scope>/<name>:pull`
 * Авторизация: `Authorization: Basic base64(<coopname>:<per-package JWT>)` —
 * username должен совпадать с `sub`-claim'ом JWT, password — сам JWT.
 *
 * Ответ: `{ access_token, token, expires_in, issued_at }` (snake_case по
 * OCI Distribution spec; `token` дублирует `access_token`).
 *
 * Имя репозитория в scope — OCI-форма БЕЗ `@`: `coopenomics/blagorost`
 * (ca-auth сам конвертит в npm-форму `@coopenomics/blagorost` для
 * сравнения с `pkg`-claim'ом).
 */
import { Injectable } from '@nestjs/common';
import { OciTokenClientPort } from './ports';

const REQUEST_TIMEOUT_MS = 10_000;

/** `@scope/name` → `scope/name` (OCI repository form). */
export function toOciRepository(packageId: string): string {
  return packageId.startsWith('@') ? packageId.slice(1) : packageId;
}

@Injectable()
export class CaAuthOciTokenClient implements OciTokenClientPort {
  constructor(private readonly caAuthBase: string) {}

  async issueToken(opts: { packageId: string; coopname: string; jwt: string }): Promise<string> {
    const scope = `repository:${toOciRepository(opts.packageId)}:pull`;
    const url = `${this.caAuthBase}/v2/auth/token?service=ca-auth&scope=${encodeURIComponent(scope)}`;
    const basic = Buffer.from(`${opts.coopname}:${opts.jwt}`, 'utf8').toString('base64');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Basic ${basic}` },
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        throw new Error(`CA-auth /v2/auth/token → HTTP ${resp.status}`);
      }
      const body = (await resp.json()) as { access_token?: string; token?: string };
      const token = body.access_token ?? body.token;
      if (typeof token !== 'string' || token.length === 0) {
        throw new Error('CA-auth /v2/auth/token: пустой access_token в ответе');
      }
      return token;
    } finally {
      clearTimeout(timer);
    }
  }
}
