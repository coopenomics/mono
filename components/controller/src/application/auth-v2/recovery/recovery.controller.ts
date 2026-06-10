import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthRateLimit } from '../rate-limit/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../rate-limit/auth-rate-limit.guard';
import { MAGIC_LINK_RULE } from '../rate-limit/auth-rate-limit.types';
import { RecoveryService } from './recovery.service';

interface RecoveryRequestBody {
  email?: string;
}

/**
 * Инициация восстановления доступа magic-link'ом (CoopID, Story 3.1).
 *
 * `POST /coop/recovery/request` принимает email и всегда отвечает `202` —
 * существование адреса наружу не раскрывается (анти-enumeration). Письмо с
 * одноразовой ссылкой уходит только реально зарегистрированному пайщику с
 * подтверждённым email. Rate-limit 3/час по email и по IP (`MAGIC_LINK_RULE`,
 * NFR10); превышение → `429 TooManyRecoveryAttempts` (отдельный код — AC
 * различает его и общий `too_many_attempts` контура входа).
 */
@Controller('coop/recovery')
export class RecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Post('request')
  @HttpCode(202)
  @UseFilters(AuthV2ExceptionFilter)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({
    ip: MAGIC_LINK_RULE,
    account: { ...MAGIC_LINK_RULE, key: (req) => keyFromEmail(req) },
    error: {
      code: AuthV2ErrorCode.TooManyRecoveryAttempts,
      message: 'Слишком много запросов на восстановление. Попробуйте позже.',
    },
  })
  async request(@Body() body: RecoveryRequestBody, @Req() req: Request): Promise<void> {
    const email = body?.email;
    if (!email || typeof email !== 'string') throw new BadRequestException('Требуется email');
    // Исход константен (всегда 202): сервис сам решает, слать письмо или нет.
    await this.recovery.requestByEmail(email, req.ip ?? null);
  }
}

/** per-account ключ rate-limit = нормализованный email (совпадает с ключом lookup'а). */
function keyFromEmail(req: Request): string | null {
  const email = (req.body as RecoveryRequestBody | undefined)?.email;
  return email && typeof email === 'string' ? normalizeUserEmail(email) : null;
}
