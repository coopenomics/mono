/**
 * @fileoverview REST-доступ coopback'а к кэшу фронт-частей (E12-2).
 *
 * Endpoints (внутренние, docker-сеть контура — как `/v1/internal/composition`;
 * наружу orchestrator опубликован только на 127.0.0.1 хоста):
 *
 *  - `GET /v1/internal/extensions/frontend` — список фактически
 *    установленных фронтов ({@link CachedFrontendMeta}[]);
 *  - `GET /v1/internal/extensions/frontend/:scope/:name/install.js` —
 *    отдача install.js из кэша + `X-Install-Script-Sha256` /
 *    `X-Package-Version` для сверки на desktop перед eval.
 *
 * JWT-gate пайщика — на стороне coopback (E12-3): он проксирует эти
 * endpoints через свой HttpJwtAuthGuard и не выставляет orchestrator
 * наружу.
 */
import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Res,
} from '@nestjs/common';
import { FrontendCacheService } from './frontend-cache.service';
import type { CachedFrontendMeta } from './ports';

const NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Минимум express-Response, который тут нужен. Пакет @types/express в
 * orchestrator не подключён (другие контроллеры отдают plain JSON), ради
 * двух заголовков его не тянем.
 */
interface HeaderSettableResponse {
  setHeader(name: string, value: string): void;
  status(code: number): unknown;
}

@Controller('v1/internal/extensions/frontend')
export class FrontendCacheController {
  constructor(private readonly cache: FrontendCacheService) {}

  @Get()
  async list(): Promise<{ items: CachedFrontendMeta[] }> {
    return { items: await this.cache.list() };
  }

  @Get(':scope/:name/install.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async installScript(
    @Param('scope') scope: string,
    @Param('name') name: string,
    @Res({ passthrough: true }) res: HeaderSettableResponse,
  ): Promise<string> {
    if (!NAME_REGEX.test(scope) || !NAME_REGEX.test(name)) {
      throw new HttpException('Invalid package coordinates', HttpStatus.NOT_FOUND);
    }
    const cached = await this.cache.read(scope, name);
    if (cached === null) {
      throw new HttpException('frontend not installed', HttpStatus.NOT_FOUND);
    }
    res.setHeader('X-Install-Script-Sha256', cached.meta.sha256);
    res.setHeader('X-Package-Version', cached.meta.version);
    res.status(HttpStatus.OK);
    return cached.content.toString('utf8');
  }
}
