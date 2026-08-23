import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { HttpJwtAuthGuard } from '@coopenomics/extension-kit';
import {
  AppsCatalogHttpService,
  type InstalledFrontendMeta,
} from '../../infrastructure/apps-catalog-http.service';

const NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

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
 * install.js берётся по-старому напрямую из ca-admin — без фильтра
 * установленности и без sha-заголовков.
 *
 * Endpoints:
 *   `GET /v1/apps-catalog/install/:scope/:name` → 200 text/javascript | 404
 *   `GET /v1/apps-catalog/installed-frontends`  → 200 {items: [...]}
 */
@Controller('v1/apps-catalog')
@UseGuards(HttpJwtAuthGuard)
export class AppsCatalogInstallScriptController {
  constructor(private readonly catalog: AppsCatalogHttpService) {}

  @Get('installed-frontends')
  async installedFrontends(): Promise<{ items: InstalledFrontendMeta[] }> {
    return { items: await this.catalog.listInstalledFrontends() };
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
    // Degraded: прямой ca-admin путь — без гарантий установленности.
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
