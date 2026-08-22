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
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthRateLimit } from '../rate-limit/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../rate-limit/auth-rate-limit.guard';
import { LOGIN_IP_RULE } from '../rate-limit/auth-rate-limit.types';
import { VerifyTimestampService } from './verify-timestamp.service';
import type { VerifyTimestampOutcome } from './verify-timestamp.service';

const BINDING_COOKIE_NAME = 'coop_session_binding';

interface VerifyTimestampBody {
  signature?: string;
  timestamp?: string;
  binding_token?: string;
}

/**
 * Второй этап двухэтапной аутентификации CoopID (Story 1.7). Принимает подпись
 * канонической метки времени (SDK `signTimestamp`, Story 2.4), доказывает владение
 * приватным ключом пайщика против COOPOS и завершает вход.
 *
 * `binding_token` берётся из body (контракт AC) либо, как fallback, из httpOnly
 * cookie `coop_session_binding`, которую ставит этап-мост (Story 1.6) — seam между
 * cookie-хранением и client-side декодированием claims разрешается на стыке 1.6/2.x.
 */
@Controller('coop/verify')
@UseFilters(AuthV2ExceptionFilter)
export class VerifyTimestampController {
  constructor(private readonly verifyService: VerifyTimestampService) {}

  @Post('timestamp')
  @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  // per-IP: аккаунт зашит в подписанном binding_token, до хендлера не извлекаем.
  @AuthRateLimit({ ip: LOGIN_IP_RULE })
  async verifyTimestamp(@Body() body: VerifyTimestampBody, @Req() req: Request): Promise<VerifyTimestampOutcome> {
    const signature = body?.signature;
    const timestamp = body?.timestamp;
    const bindingToken = body?.binding_token ?? this.readBindingCookie(req);

    if (!signature || !timestamp || !bindingToken)
      throw new BadRequestException('Требуются signature, timestamp и binding_token');

    // AuthV2Error из сервиса пробрасывается контурному AuthV2ExceptionFilter
    // (Story 1.11) — единый маппинг код→HTTP/OAuth2.
    return this.verifyService.verify({
      signature,
      timestamp,
      bindingToken,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      acceptLanguage: req.headers['accept-language'] ?? null,
    });
  }

  private readBindingCookie(req: Request): string | undefined {
    const fromParser = (req as Request & { cookies?: Record<string, string> }).cookies?.[BINDING_COOKIE_NAME];
    if (fromParser) return fromParser;
    const header = req.headers.cookie ?? '';
    const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${BINDING_COOKIE_NAME}=`));
    return match ? decodeURIComponent(match.slice(BINDING_COOKIE_NAME.length + 1)) : undefined;
  }
}
