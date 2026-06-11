/**
 * @fileoverview Реальный импл {@link FrontendInstallSourcePort} — E12-2.
 *
 * Бьёт в ca-admin `GET /v1/public/packages/:scope/:name/install.js`
 * (E12-1: источник — npm-tarball активного релиза) с admin API key
 * контура — те же env-имена, что у coopback-прокси
 * (`APPS_CATALOG_URL` / `APPS_CATALOG_API_KEY`).
 *
 * Маппинг ответов:
 *  - 200 → ok + заголовки X-Install-Script-Sha256 / X-Package-Version;
 *  - 404 → notFound (нет активного релиза или пакет backend-only);
 *  - прочее/сеть/timeout → unavailable (кэш не трогаем).
 */
import { Logger } from '@nestjs/common';
import type { FrontendInstallFetchOutcome, FrontendInstallSourcePort } from './ports';

const REQUEST_TIMEOUT_MS = 15_000;

export interface CaAdminInstallSourceConfig {
  baseUrl: string;
  apiKey: string;
}

export class CaAdminInstallSource implements FrontendInstallSourcePort {
  private readonly logger = new Logger(CaAdminInstallSource.name);

  constructor(private readonly cfg: CaAdminInstallSourceConfig) {}

  async fetchInstallScript(
    scope: string,
    name: string,
  ): Promise<FrontendInstallFetchOutcome> {
    const path = `/v1/public/packages/${encodeURIComponent(scope)}/${encodeURIComponent(name)}/install.js`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await this.fetch(`${this.cfg.baseUrl}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
        signal: ctrl.signal,
      });
      if (resp.status === 404) {
        return { status: 'notFound', reason: `ca-admin ${path} → 404` };
      }
      if (!resp.ok) {
        return { status: 'unavailable', reason: `ca-admin ${path} → HTTP ${resp.status}` };
      }
      const content = Buffer.from(await resp.arrayBuffer());
      return {
        status: 'ok',
        content,
        declaredSha256: resp.headers.get('x-install-script-sha256'),
        version: resp.headers.get('x-package-version'),
      };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`install.js fetch @${scope}/${name} failed: ${reason}`);
      return { status: 'unavailable', reason };
    } finally {
      clearTimeout(timer);
    }
  }

  /** @internal protected — тесты подменяют транспорт без сети. */
  protected fetch(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, init);
  }
}

/**
 * Noop-источник для degraded mode (env каталога не задан): всегда
 * `unavailable`, чтобы кэш жил на том, что уже на диске, и стенд без
 * каталога стартовал без ошибок.
 */
export class NoopInstallSource implements FrontendInstallSourcePort {
  async fetchInstallScript(): Promise<FrontendInstallFetchOutcome> {
    return {
      status: 'unavailable',
      reason: 'APPS_CATALOG_URL/APPS_CATALOG_API_KEY не заданы — источник install.js отключён',
    };
  }
}
