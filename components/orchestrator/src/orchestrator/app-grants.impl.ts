import { Logger } from '@nestjs/common';
import { AppConsentRequiredError, type AppGrantsPort } from './ports';

const REQUEST_TIMEOUT_MS = 10_000;
/** Ответ ядра «права сверх согласия председателя». */
const CONSENT_REQUIRED_STATUS = 409;

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

  /** Адрес входа портов ядра для контейнера приложения. */
  readonly coreUrl: string;

  /**
   * @param grantsUrl — ядро по сети узла: заявки заводит и стирает оркестратор.
   * @param appsCoreUrl — вход портов для контейнеров приложений. У узла с
   *   закрытой сетью приложений это шлюз портов; не задан — то же ядро.
   */
  constructor(
    private readonly grantsUrl: string,
    private readonly serverSecret: string,
    private readonly fetchFn: typeof fetch = fetch,
    appsCoreUrl?: string,
  ) {
    this.coreUrl = appsCoreUrl && appsCoreUrl.length > 0 ? appsCoreUrl : grantsUrl;
  }

  async issue(opts: { packageId: string; version: string; ports: string[]; chainActions: string[] }): Promise<string> {
    const res = await this.fetchFn(`${this.grantsUrl}/v1/internal/app-grants/${grantPath(opts.packageId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'server-secret': this.serverSecret },
      body: JSON.stringify({ ports: opts.ports, chain_actions: opts.chainActions, version: opts.version }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // 409 — версия просит права сверх согласия председателя: ядро записало запрос и ждёт ответа.
    if (res.status === CONSENT_REQUIRED_STATUS) throw new AppConsentRequiredError(opts.packageId);
    if (!res.ok) throw new Error(`ядро не завело заявку ${opts.packageId}: HTTP ${res.status}`);
    const body = (await res.json()) as { token?: string };
    if (typeof body.token !== 'string' || body.token.length === 0) {
      throw new Error(`ядро не вернуло токен приложения ${opts.packageId}`);
    }
    return body.token;
  }

  async revoke(packageId: string): Promise<void> {
    try {
      const res = await this.fetchFn(`${this.grantsUrl}/v1/internal/app-grants/${grantPath(packageId)}`, {
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
