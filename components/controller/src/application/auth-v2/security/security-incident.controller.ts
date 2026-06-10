import { Body, Controller, Param, Post, Req, UnauthorizedException, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { SecurityIncidentService } from './security-incident.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string };
}

interface NotMeBody {
  /** id сессии, помеченной подозрительной (опц., из настроек). */
  sessionId?: string;
}

/**
 * Флаг «Это не я» (CoopID, Story 3.10) — немедленный отзыв всех сессий пайщика.
 *
 * `POST /coop/security/not-me` — из настроек ЛК (под JWT-guard, subject = user.id).
 * `POST /coop/security/not-me/:token` — one-click из письма о новом устройстве (3.9):
 *   без аутентификации (своя сессия могла быть скомпрометирована), авторизация — по
 *   одноразовому токену из ссылки.
 */
@Controller('coop/security')
@UseFilters(AuthV2ExceptionFilter)
export class SecurityIncidentController {
  constructor(private readonly incidents: SecurityIncidentService) {}

  @Post('not-me')
  @UseGuards(HttpJwtAuthGuard)
  async notMe(@Body() body: NotMeBody, @Req() req: AuthedRequest): Promise<{ revoked: number }> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    return this.incidents.report({ subjectId: user.id, ip: req.ip ?? null, source: 'settings', reportedSessionId: body?.sessionId ?? null });
  }

  @Post('not-me/:token')
  async notMeOneClick(@Param('token') token: string, @Req() req: AuthedRequest): Promise<{ revoked: number }> {
    return this.incidents.reportByToken(token, req.ip ?? null);
  }
}
