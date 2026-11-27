import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Delete, Headers, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError, platformSettings } from '@coopenomics/extension-kit';
import { AppPortGrantsService } from '../services/app-port-grants.service';
import { AppRightsConsentService } from '../services/app-rights-consent.service';
import { RemotePortsService } from '../services/remote-ports.service';

/** Сравнение секретов за постоянное время: длина ответа не выдаёт совпавшую часть. */
function sameSecret(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Вход портов ядра для приложений каталога (487-17, ADR-18).
 *
 * `POST /v1/internal/ports/:port/:method` — тело `{ args: [...] }`, ответ
 * `{ result }`. Приложение в своём контейнере предъявляет токен приложения
 * (`Authorization: Bearer apt_…`), выданный при установке. Маршрут доступен из
 * docker-сети узла; наружу его не публикует ни nginx стенда, ни шлюз.
 */
@Controller('v1/internal/ports')
export class AppPortsController {
  constructor(
    private readonly grants: AppPortGrantsService,
    private readonly ports: RemotePortsService,
  ) {}

  /**
   * Вызвать метод порта от имени приложения.
   *
   * @throws DomainError `APPS_CATALOG_PROXY_APP_PORT_TOKEN_INVALID` — токена нет, он неизвестен или отозван.
   */
  @Post(':port/:method')
  @HttpCode(200)
  async call(
    @Headers('authorization') authorization: string | undefined,
    @Param('port') port: string,
    @Param('method') method: string,
    @Body() body: { args?: unknown[] } | undefined,
  ): Promise<{ result: unknown }> {
    const token = authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const grant = await this.grants.byToken(token);
    if (!grant) throw DomainError.unauthorized('APPS_CATALOG_PROXY_APP_PORT_TOKEN_INVALID');
    const args = Array.isArray(body?.args) ? body.args : [];
    const result = await this.ports.call(grant, platformSettings().coopname, port, method, args);
    // undefined в JSON пропадает вместе с ключом — клиенту отдаём явный null.
    return { result: result === undefined ? null : result };
  }
}

/**
 * Заявки приложений: оркестратор узла заводит заявку при установке приложения
 * и стирает при снятии. Вход — межсервисный `server-secret`, как у остальных
 * обращений сервисов узла к ядру.
 */
@Controller('v1/internal/app-grants')
export class AppPortGrantsController {
  constructor(
    private readonly grants: AppPortGrantsService,
    private readonly consents: AppRightsConsentService,
    private readonly config: ConfigService,
  ) {}

  private assertService(secret: string | undefined): void {
    if (!sameSecret(secret, this.config.get<string>('SERVER_SECRET'))) {
      throw DomainError.unauthorized('APPS_CATALOG_PROXY_APP_GRANT_SERVICE_ONLY');
    }
  }

  /**
   * Завести или заменить заявку пакета. Ответ несёт токен приложения — его
   * оркестратор кладёт в окружение контейнера.
   *
   * Ключ выдаётся только в пределах согласия председателя. Версия, которая
   * просит больше, получает отказ 409: оркестратор оставляет работать прежнюю
   * версию с прежним ключом, запрос новых прав ждёт ответа председателя.
   *
   * @throws DomainError `APPS_CATALOG_PROXY_APP_CONSENT_REQUIRED` — версия просит права сверх согласия.
   */
  @Put(':scope/:name')
  async issue(
    @Headers('server-secret') secret: string | undefined,
    @Param('scope') scope: string,
    @Param('name') name: string,
    @Body() body: { ports?: unknown; chain_actions?: unknown; version?: unknown } | undefined,
  ): Promise<{ token: string; ports: string[]; chain_actions: string[] }> {
    this.assertService(secret);
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    const packageId = packageIdOf(scope, name);
    const declared = { ports: strings(body?.ports), chainActions: strings(body?.chain_actions) };
    const version = typeof body?.version === 'string' ? body.version : '';
    if (!(await this.consents.admit(packageId, declared, version))) {
      throw DomainError.conflict('APPS_CATALOG_PROXY_APP_CONSENT_REQUIRED', { package_id: packageId });
    }
    const issued = await this.grants.issue(packageId, declared);
    return { token: issued.token, ports: issued.ports, chain_actions: issued.chainActions };
  }

  /** Стереть заявку пакета: приложение снято, его токен больше не принимается. */
  @Delete(':scope/:name')
  @HttpCode(200)
  async revoke(
    @Headers('server-secret') secret: string | undefined,
    @Param('scope') scope: string,
    @Param('name') name: string,
  ): Promise<{ ok: true }> {
    this.assertService(secret);
    await this.grants.revoke(packageIdOf(scope, name));
    return { ok: true };
  }
}

/** `voskhod` + `exampleapp` → `@voskhod/exampleapp`; «собака» в адресе необязательна. */
function packageIdOf(scope: string, name: string): string {
  return `${scope.startsWith('@') ? scope : `@${scope}`}/${name}`;
}
