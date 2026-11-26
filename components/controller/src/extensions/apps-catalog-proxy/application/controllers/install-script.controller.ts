import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, HttpJwtAuthGuard } from '@coopenomics/extension-kit';
import { DOCUMENT_PORT, type IDocumentPort, type InnerGeneratedDocument } from '@coopenomics/innercoop';
import {
  AppsCatalogHttpService,
  type InstalledFrontendMeta,
} from '../../infrastructure/apps-catalog-http.service';
import { AppSessionService } from '../services/app-session.service';
import { CatalogAppsStateService } from '../services/catalog-apps-state.service';

const NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Хэш документа: sha256 в шестнадцатеричной записи. */
const DOCUMENT_HASH_REGEX = /^[a-fA-F0-9]{64}$/;

/**
 * Story 9.4.b → E12-3 — доставка install.js remote-расширений desktop'у.
 *
 * Источник — volume-кэш orchestrator'а контура (E12-2): только пакеты,
 * реально установленные у кооператива (подписка активна, sha256 install.js
 * сверен orchestrator'ом с декларацией манифеста). Заголовки
 * `X-Install-Script-Sha256` / `X-Package-Version` пробрасываются —
 * desktop сверяет sha256 перед eval.
 *
 * Защищён HTTP JWT — пайщик должен быть залогинен в свой кооператив.
 * Orchestrator наружу не торчит (docker-сеть), admin-ключи в браузер
 * не утекают.
 *
 * Degraded fallback: без ORCHESTRATOR_URL (dev-стенд без federation-профиля)
 * install.js берётся по-старому напрямую из catalog-operator — без фильтра
 * установленности и без sha-заголовков.
 *
 * Endpoints:
 *   `GET /v1/apps-catalog/install/:scope/:name` → 200 text/javascript | 404
 *   `GET /v1/apps-catalog/installed-frontends`  → 200 {items: [...]}
 */
@Controller('v1/apps-catalog')
@UseGuards(HttpJwtAuthGuard)
export class AppsCatalogInstallScriptController {
  constructor(
    private readonly catalog: AppsCatalogHttpService,
    private readonly state: CatalogAppsStateService,
    private readonly sessions: AppSessionService,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
  ) {}

  /**
   * Фронты, которые рабочий стол грузит: получены оркестратором и не
   * выключены на узле. Выключенное приложение остаётся в кэше и в подписке,
   * но на стол не попадает — как выключенное встроенное расширение.
   */
  @Get('installed-frontends')
  async installedFrontends(): Promise<{ items: InstalledFrontendMeta[] }> {
    const [items, disabled] = await Promise.all([this.catalog.listInstalledFrontends(), this.state.disabledPackageIds()]);
    return { items: items.filter((item) => !disabled.has(item.packageId)) };
  }

  /**
   * Токен пайщика для бэкенда одного приложения каталога (487-18).
   *
   * Стол запрашивает его для изолированной рамки приложения и сам подставляет в
   * запросы рамки. Токен пайщика рамка не получает. Запрос межсервисным
   * секретом без пайщика отклоняется: токен выдаётся человеку, а не службе.
   *
   * @throws DomainError `APPS_CATALOG_PROXY_APP_SESSION_NO_MEMBER` — запрос без пайщика.
   */
  @Post('app-session/:scope/:name')
  async appSession(
    @Param('scope') scope: string,
    @Param('name') name: string,
    @Req() req: { user?: { username?: unknown; role?: unknown; status?: unknown } },
  ): Promise<{ token: string; expires_at: string; username: string }> {
    if (!NAME_REGEX.test(scope) || !NAME_REGEX.test(name)) {
      throw new HttpException('Invalid package coordinates', HttpStatus.NOT_FOUND);
    }
    const username = req.user?.username;
    if (typeof username !== 'string' || username.length === 0) {
      throw DomainError.forbidden('APPS_CATALOG_PROXY_APP_SESSION_NO_MEMBER');
    }
    const { token, expiresAt } = await this.sessions.issue(`@${scope}/${name}`, {
      username,
      role: String(req.user?.role ?? ''),
      status: String(req.user?.status ?? ''),
    });
    return { token, expires_at: expiresAt, username };
  }

  /**
   * Документ по хэшу — для окна подписи стола (487-18).
   *
   * Приложение в изолированной рамке называет столу только хэш документа.
   * Текст для показа пайщику стол берёт у ядра, а не у приложения: иначе
   * приложение показало бы один текст, а подписало другой.
   *
   * @throws DomainError `APPS_CATALOG_PROXY_APP_DOCUMENT_NOT_FOUND` — документа с таким хэшем ядро не формировало.
   */
  @Get('app-document/:hash')
  @Header('Cache-Control', 'no-store')
  async appDocument(@Param('hash') hash: string): Promise<InnerGeneratedDocument> {
    if (!DOCUMENT_HASH_REGEX.test(hash)) {
      throw new HttpException('Invalid document hash', HttpStatus.NOT_FOUND);
    }
    const document = await this.documents.getByHash(hash.toUpperCase());
    if (document === null) {
      throw DomainError.notFound('APPS_CATALOG_PROXY_APP_DOCUMENT_NOT_FOUND', { hash });
    }
    return document;
  }

  @Get('install/:scope/:name')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async execute(
    @Param('scope') scope: string,
    @Param('name') name: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    if (!NAME_REGEX.test(scope) || !NAME_REGEX.test(name)) {
      throw new HttpException(
        'Invalid package coordinates',
        HttpStatus.NOT_FOUND,
      );
    }
    if (this.catalog.orchestratorConfigured) {
      const installed = await this.catalog.fetchInstalledInstallScript(
        scope,
        name,
      );
      if (installed === null) {
        throw new HttpException(
          'frontend not installed',
          HttpStatus.NOT_FOUND,
        );
      }
      if (installed.sha256 !== null) {
        res.setHeader('X-Install-Script-Sha256', installed.sha256);
      }
      if (installed.version !== null) {
        res.setHeader('X-Package-Version', installed.version);
      }
      res.status(HttpStatus.OK);
      return installed.code;
    }
    // Degraded: прямой catalog-operator путь — без гарантий установленности.
    const code = await this.catalog.fetchInstallScript(scope, name);
    if (code === null) {
      throw new HttpException(
        'install.js not available',
        HttpStatus.NOT_FOUND,
      );
    }
    res.status(HttpStatus.OK);
    return code;
  }
}
