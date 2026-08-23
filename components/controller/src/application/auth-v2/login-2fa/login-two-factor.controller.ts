import { BadRequestException, Body, Controller, HttpCode, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthRateLimit } from '../rate-limit/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../rate-limit/auth-rate-limit.guard';
import { LOGIN_IP_RULE } from '../rate-limit/auth-rate-limit.types';
import { LoginTwoFactorService } from './login-two-factor.service';
import type { SecondFactorConfirmResult } from './login-two-factor.service';

interface ConfirmBody {
  challenge_token?: string;
  code?: string;
}

interface ResendBody {
  challenge_token?: string;
}

/**
 * Подтверждение второго фактора входа (2FA-логин). Challenge выдаёт
 * `POST /coop/verify/timestamp`, когда у пайщика включены факторы; токены сессии
 * выпускаются ТОЛЬКО здесь — после прохождения всех факторов по очереди.
 *
 * Анти-перебор: rate-limit per-IP + атомарный счётчик неверных кодов внутри
 * challenge (5 → challenge сжигается, вход начинается заново с пароля и ключа).
 */
@Controller('coop/verify/2fa')
@UseFilters(AuthV2ExceptionFilter)
export class LoginTwoFactorController {
  constructor(private readonly service: LoginTwoFactorService) {}

  @Post('confirm')
  @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  // per-IP: аккаунт зашит в server-side состоянии challenge, до хендлера не извлекаем.
  @AuthRateLimit({ ip: LOGIN_IP_RULE })
  async confirm(@Body() body: ConfirmBody, @Req() req: Request): Promise<SecondFactorConfirmResult> {
    if (!body?.challenge_token || !body?.code) {
      throw new BadRequestException('Требуются challenge_token и code');
    }
    return this.service.confirm({ token: body.challenge_token, code: body.code, ip: req.ip ?? null });
  }

  @Post('resend')
  @HttpCode(202)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({ ip: LOGIN_IP_RULE })
  async resend(@Body() body: ResendBody, @Req() req: Request): Promise<{ status: 'sent' }> {
    if (!body?.challenge_token) throw new BadRequestException('Требуется challenge_token');
    await this.service.resendEmailCode(body.challenge_token, req.ip ?? null);
    return { status: 'sent' };
  }
}
