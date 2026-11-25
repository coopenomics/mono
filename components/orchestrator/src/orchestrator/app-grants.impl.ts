import { Logger } from '@nestjs/common';
import type { AppGrantsPort } from './ports';

const REQUEST_TIMEOUT_MS = 10_000;

/** `@voskhod/exampleapp` → `voskhod/exampleapp` для адреса маршрута ядра. */
function grantPath(packageId: string): string {
  const [scope, name] = packageId.replace(/^@/, '').split('/');
  return `${encodeURIComponent(scope ?? '')}/${encodeURIComponent(name ?? '')}`;
}

/**
 * Заявки приложений в ядре: `PUT|DELETE /v1/internal/app-grants/:scope/:name`.
 * Вход — межсервисный `server-secret` узла, как у остальных обращений
 * сервисов узла к ядру.
 */
export class HttpAppGrants implements AppGrantsPort {
  private readonly logger = new Logger(HttpAppGrants.name);

  constructor(
    readonly coreUrl: string,
    private readonly serverSecret: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async issue(opts: { packageId: string; ports: string[]; chainActions: string[] }): Promise<string> {
    const res = await this.fetchFn(`${this.coreUrl}/v1/internal/app-grants/${grantPath(opts.packageId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'server-secret': this.serverSecret },
      body: JSON.stringify({ ports: opts.ports, chain_actions: opts.chainActions }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`ядро не завело заявку ${opts.packageId}: HTTP ${res.status}`);
    const body = (await res.json()) as { token?: string };
    if (typeof body.token !== 'string' || body.token.length === 0) {
      throw new Error(`ядро не вернуло токен приложения ${opts.packageId}`);
    }
    return body.token;
  }

  async revoke(packageId: string): Promise<void> {
    try {
      const res = await this.fetchFn(`${this.coreUrl}/v1/internal/app-grants/${grantPath(packageId)}`, {
        method: 'DELETE',
        headers: { 'server-secret': this.serverSecret },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) this.logger.warn(`заявка ${packageId} не стёрта: HTTP ${res.status}`);
    } catch (e) {
      // Контейнер всё равно снимается: без него токен предъявить некому.
      this.logger.warn(`заявка ${packageId} не стёрта: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
