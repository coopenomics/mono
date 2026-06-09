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
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { AppsCatalogHttpService } from '../../infrastructure/apps-catalog-http.service';

const NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Story 9.4.b — REST-проксирование install.js пакета из apps-catalog к
 * desktop'у. Защищён HTTP JWT — пайщик должен быть залогинен в свой
 * кооператив, иначе нельзя загружать remote-расширения. Admin-API ключ
 * apps-catalog'а инкапсулирован в backend'е и не утекает в браузер
 * (см. architecture-choice C в Epic 9.5.b).
 *
 * Endpoint:
 *   `GET /v1/apps-catalog/install/:scope/:name`
 *   → 200 text/javascript — CJS install.js
 *   → 404 если пакета нет (или ca-admin недоступен в degraded mode).
 *   → 401 без JWT.
 */
@Controller('v1/apps-catalog/install')
@UseGuards(HttpJwtAuthGuard)
export class AppsCatalogInstallScriptController {
  constructor(private readonly catalog: AppsCatalogHttpService) {}

  @Get(':scope/:name')
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
