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
import { HttpJwtAuthGuard } from '@coopenomics/extension-kit';
import { setSessionCookieBySid } from '../session-cookie/session-cookie';

/** Тело ответа bind: session_binding_token + TTL в секундах. */
interface BindResult {
  binding_token: string;
  expires_in: number;
}

/**
 * Этап-мост двухэтапной аутентификации (CoopID, Story 1.6, вариант B).
 * Вызывается фронтом сразу после прохождения authentik-password на общем домене:
 * сессионная cookie authentik доезжает сюда, controller выпускает
 * session_binding_token.
 *
 * Токен отдаётся ДВУМЯ путями (Эпик 7, решение D2): (1) в теле ответа —
 * клиентский `@coopenomics/auth.signTimestamp` читает из него `jti`/`sub`, чтобы
 * собрать каноническое сообщение байт-в-байт (без него подпись невозможна, а
 * httpOnly-cookie из JS не читается); (2) в httpOnly secure cookie — defense-in-depth
 * и fallback для `/coop/verify/timestamp` (тот принимает binding_token из тела ИЛИ
 * cookie). Токен одноразовый (jti single-use в Redis) + TTL 120с + бесполезен без
 * приватного ключа пайщика, поэтому выдача его в тело не расширяет поверхность атаки.
 */
@Controller('coop/session')
export class SessionBindingController {
  constructor(
    @Inject(AUTHN_SESSION_PORT) private readonly authnSession: IAuthnSessionPort,
    private readonly binding: SessionBindingService,
  ) {}

  /**
   * Cookie сессии для уже вошедшего пайщика. Нужна на переходе: у действующих
   * сессий cookie нет, а access-токен живёт сотни дней — обновления, которое
   * поставило бы её, можно не дождаться. Клиент зовёт эту точку один раз, когда
   * серверный рендер его не узнал, а сессия в браузере есть. Токен без `sid`
   * (выпущен до появления идентификатора сессии) cookie дать не может — клиенту
   * сообщается, что нужно обновление токенов.
   */
  @Post('cookie')
  @HttpCode(200)
  @UseGuards(HttpJwtAuthGuard)
  ensureCookie(@Req() req: Request, @Res({ passthrough: true }) res: Response): { status: 'ok' | 'refresh_required' } {
    const sid = (req as Request & { user?: { session_id?: string | null } }).user?.session_id ?? null;
    if (!sid) return { status: 'refresh_required' };
    setSessionCookieBySid(req, res, sid);
    return { status: 'ok' };
  }

  @Post('bind')
  @HttpCode(200)
  @UseFilters(AuthV2ExceptionFilter)
  @UseGuards(AuthRateLimitGuard)
  // per-IP only: username резолвится из cookie authentik уже внутри хендлера,
  // в guard'е (до обработчика) аккаунт неизвестен — per-account ключ не навешиваем.
  @AuthRateLimit({ ip: LOGIN_IP_RULE })
  async bind(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<BindResult> {
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

    return { binding_token: issued.token, expires_in: issued.maxAgeSec };
  }
}
