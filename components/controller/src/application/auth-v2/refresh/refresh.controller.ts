import { BadRequestException, Body, Controller, HttpCode, Post, UseFilters } from '@nestjs/common';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { RefreshService } from './refresh.service';
import type { RefreshResult } from './refresh.service';

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
  async refresh(@Body() body: RefreshBody): Promise<RefreshResult> {
    const refreshToken = body?.refresh_token;
    if (!refreshToken) throw new BadRequestException('Требуется refresh_token');
    return this.refreshService.refresh(refreshToken);
  }
}
