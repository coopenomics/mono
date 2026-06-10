import {
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTHN_SESSION_PORT } from '~/domain/auth-v2/ports/authn-session.port';
import type { IAuthnSessionPort } from '~/domain/auth-v2/ports/authn-session.port';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthRateLimit } from '../rate-limit/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../rate-limit/auth-rate-limit.guard';
import { LOGIN_IP_RULE } from '../rate-limit/auth-rate-limit.types';
import { SessionBindingService } from './session-binding.service';

/**
 * Этап-мост двухэтапной аутентификации (CoopID, Story 1.6, вариант B).
 * Вызывается фронтом сразу после прохождения authentik-password на общем домене:
 * сессионная cookie authentik доезжает сюда, controller выпускает
 * session_binding_token в HTTP-only secure cookie.
 */
@Controller('coop/session')
export class SessionBindingController {
  constructor(
    @Inject(AUTHN_SESSION_PORT) private readonly authnSession: IAuthnSessionPort,
    private readonly binding: SessionBindingService,
  ) {}

  @Post('bind')
  @HttpCode(204)
  @UseFilters(AuthV2ExceptionFilter)
  @UseGuards(AuthRateLimitGuard)
  // per-IP only: username резолвится из cookie authentik уже внутри хендлера,
  // в guard'е (до обработчика) аккаунт неизвестен — per-account ключ не навешиваем.
  @AuthRateLimit({ ip: LOGIN_IP_RULE })
  async bind(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const cookieHeader = req.headers.cookie ?? '';

    let username: string | null;
    try {
      username = await this.authnSession.resolveUsername(cookieHeader);
    } catch {
      throw new ServiceUnavailableException('authentik unavailable');
    }
    if (!username) throw new UnauthorizedException();

    const issued = await this.binding.issue(username);
    res.cookie(issued.cookieName, issued.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: issued.maxAgeSec * 1000,
      path: '/',
    });
  }
}
