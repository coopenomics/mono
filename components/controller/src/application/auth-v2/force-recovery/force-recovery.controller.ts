import { Controller, Param, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthRateLimit } from '../rate-limit/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../rate-limit/auth-rate-limit.guard';
import { MAGIC_LINK_RULE } from '../rate-limit/auth-rate-limit.types';
import { ForceRecoveryService } from './force-recovery.service';

/**
 * Согласие пайщика на принудительное восстановление по magic-link (CoopID, Story 6.9).
 * Остаётся REST: пайщик подтверждает согласие кликом из письма без auth-guard и без
 * SDK-контекста (доступ мог быть утрачен), авторизация — по одноразовому токену из ссылки.
 *
 * Запрос согласия и авторизация председателем (под JWT+CASL) переведены в GraphQL/SDK —
 * см. `CriticalActionsResolver.requestForceRecoveryConsent` / `authorizeForceRecovery`
 * (Фаза 2 миграции REST→GraphQL/SDK).
 */
@Controller('coop/force-recovery')
@UseFilters(AuthV2ExceptionFilter)
export class ForceRecoveryController {
  constructor(private readonly service: ForceRecoveryService) {}

  @Post('consent/:token')
  // Токен в ссылке длинный, но перебор без ограничения ничем не сдерживался:
  // 10 обращений в час с одного адреса хватает на повторный клик из письма;
  // счётчик свой — вход и чтение блоба его не расходуют.
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({ ip: MAGIC_LINK_RULE, scope: 'force-recovery-consent' })
  async grantConsent(@Param('token') token: string, @Req() req: Request): Promise<{ status: 'granted'; targetId: string }> {
    const { targetId } = await this.service.grantConsent(token, req.ip ?? null);
    return { status: 'granted', targetId };
  }
}
