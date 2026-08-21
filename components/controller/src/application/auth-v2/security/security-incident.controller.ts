import { Controller, Param, Post, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { SecurityIncidentService } from './security-incident.service';

/**
 * One-click «Это не я» из письма о новом устройстве (CoopID, Story 3.9) — немедленный
 * отзыв всех сессий пайщика. Остаётся REST: клик по magic-link из письма приходит без
 * аутентификации и без SDK-контекста (своя сессия могла быть скомпрометирована),
 * авторизация — по одноразовому токену из ссылки.
 *
 * Сигнал «Это не я» из настроек ЛК (под JWT) переведён в GraphQL/SDK —
 * см. `AccountSecurityResolver.reportNotMe` (Фаза 2 миграции REST→GraphQL/SDK).
 */
@Controller('coop/security')
@UseFilters(AuthV2ExceptionFilter)
export class SecurityIncidentController {
  constructor(private readonly incidents: SecurityIncidentService) {}

  @Post('not-me/:token')
  async notMeOneClick(@Param('token') token: string, @Req() req: Request): Promise<{ revoked: number }> {
    return this.incidents.reportByToken(token, req.ip ?? null);
  }
}
