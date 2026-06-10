import {
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import config from '~/config/config';
import { AUTHN_SESSION_PORT } from '~/domain/auth-v2/ports/authn-session.port';
import type { IAuthnSessionPort } from '~/domain/auth-v2/ports/authn-session.port';
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
