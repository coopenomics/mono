import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { VerifyTimestampService } from './verify-timestamp.service';
import type { VerifyTimestampResult } from './verify-timestamp.service';

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
export class VerifyTimestampController {
  constructor(private readonly verifyService: VerifyTimestampService) {}

  @Post('timestamp')
  @HttpCode(200)
  async verifyTimestamp(@Body() body: VerifyTimestampBody, @Req() req: Request): Promise<VerifyTimestampResult> {
    const signature = body?.signature;
    const timestamp = body?.timestamp;
    const bindingToken = body?.binding_token ?? this.readBindingCookie(req);

    if (!signature || !timestamp || !bindingToken)
      throw new BadRequestException('Требуются signature, timestamp и binding_token');

    try {
      return await this.verifyService.verify({
        signature,
        timestamp,
        bindingToken,
        ip: req.ip ?? null,
      });
    } catch (e) {
      if (e instanceof AuthV2Error) throw this.toHttp(e);
      throw e;
    }
  }

  private readBindingCookie(req: Request): string | undefined {
    const fromParser = (req as Request & { cookies?: Record<string, string> }).cookies?.[BINDING_COOKIE_NAME];
    if (fromParser) return fromParser;
    const header = req.headers.cookie ?? '';
    const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${BINDING_COOKIE_NAME}=`));
    return match ? decodeURIComponent(match.slice(BINDING_COOKIE_NAME.length + 1)) : undefined;
  }

  /**
   * Маппинг типизированной ошибки auth-v2 в HTTP с телом OAuth 2.0. Inline до
   * Story 1.11 (там — глобальный ExceptionFilter единым контуром).
   */
  private toHttp(e: AuthV2Error): HttpException {
    const body = e.toResponse();
    switch (e.code) {
      case AuthV2ErrorCode.CooposDegraded:
        return new ServiceUnavailableException(body);
      case AuthV2ErrorCode.SessionBindingExpired:
      case AuthV2ErrorCode.SessionBindingReused:
      case AuthV2ErrorCode.TimestampTooOld:
      case AuthV2ErrorCode.ChainVerificationFailed:
      default:
        return new UnauthorizedException(body);
    }
  }
}
