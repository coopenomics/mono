import { Body, Controller, HttpCode, Post, Req, Res, UseFilters } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { RefreshService } from './refresh.service';
import type { RefreshResult } from './refresh.service';
import { setSessionCookie } from '../session-cookie/session-cookie';
import { DomainError } from '@coopenomics/extension-kit';

interface RefreshBody {
  refresh_token?: string;
}

/**
 * Обновление токенов контура CoopID (Эпик 7, REST `/coop/*`). `@coopenomics/auth`
 * держит токен-lifecycle через REST (как `/coop/logout`), а не GraphQL — этот
 * эндпоинт его REST-точка обновления. Legacy GraphQL-`refresh` остаётся для
 * legacy-контура; оба используют одну токен-машинерию (см. RefreshService).
 */
@Controller('coop/refresh')
@UseFilters(AuthV2ExceptionFilter)
export class RefreshController {
  constructor(private readonly refreshService: RefreshService) {}

  @Post()
  @HttpCode(200)
  async refresh(
    @Body() body: RefreshBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<RefreshResult> {
    const refreshToken = body?.refresh_token;
    if (!refreshToken) throw DomainError.badRequest('AUTH_V2_REFRESH_TOKEN_REQUIRED');
    const result = await this.refreshService.refresh(refreshToken);
    // Личность сессии при обновлении не меняется — продлеваем cookie на новый срок.
    setSessionCookie(req, res, result.access_token);
    return result;
  }
}
