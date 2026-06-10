import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LogoutService } from './logout.service';

const BINDING_COOKIE_NAME = 'coop_session_binding';

interface LogoutBody {
  refresh_token?: string;
  access_token?: string;
}

/**
 * RP-initiated logout (Story 1.10): закрывает сессию пайщика в этом браузере —
 * отзывает refresh/access токены, защитно гасит cookie session_binding и пишет
 * audit_events. Без guard и идемпотентен: выйти можно и с истёкшим access-токеном,
 * повторный вызов не ошибка. OIDC `end_session_endpoint` с `id_token_hint` — Story 5.1.
 */
@Controller('coop/logout')
export class LogoutController {
  constructor(private readonly logoutService: LogoutService) {}

  @Post()
  @HttpCode(204)
  async logout(@Body() body: LogoutBody, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.logoutService.logout({
      refreshToken: body?.refresh_token ?? null,
      accessToken: body?.access_token ?? null,
      ip: req.ip ?? null,
    });

    res.clearCookie(BINDING_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  }
}
