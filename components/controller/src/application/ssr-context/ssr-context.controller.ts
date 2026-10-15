import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { hasServerSecret } from '@coopenomics/extension-kit';
import { SsrContextService, type SsrContextResult } from './ssr-context.service';

/**
 * Служебная точка для серверного рендера кабинета. Отвечает только серверу с
 * `server-secret`: браузеру сюда хода нет, cookie сессии без секрета ничего не
 * открывает. SSR пересылает заголовок Cookie документ-запроса как есть.
 */
@Controller('coop/ssr-context')
export class SsrContextController {
  constructor(private readonly service: SsrContextService) {}

  @Get()
  async context(@Req() req: Request): Promise<SsrContextResult> {
    if (!hasServerSecret(req.headers)) throw new UnauthorizedException();
    return this.service.resolve(req.headers.cookie);
  }
}
