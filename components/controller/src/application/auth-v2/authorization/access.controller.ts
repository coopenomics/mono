import { Controller, Get, Req, UnauthorizedException, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import type { ParticipantAccess } from '~/domain/auth-v2/ports/capability-sets.port';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { CapabilitySetService } from './capability-set.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string; role?: string };
}

/**
 * Эффективный доступ текущего пайщика (Story 6.11) — основание гейтинга столов/страниц на
 * фронте. `GET /coop/access/me` отдаёт активные наборы + плоский список грантов из собранной
 * Ability (core-роли + персональные гранты + назначенные наборы). Фронт-`useCoopAccess()`
 * сверяется с этим списком, показывая/скрывая столы и страницы по выданным правам.
 *
 * Это CoopID-side seam той же модели resource:action, что и grants marketplace2 — при мердже
 * сводятся (общий getDesktop grants), без дублирования провайдера здесь.
 */
@Controller('coop/access')
@UseFilters(AuthV2ExceptionFilter)
export class AccessController {
  constructor(private readonly service: CapabilitySetService) {}

  @Get('me')
  @UseGuards(HttpJwtAuthGuard)
  async me(@Req() req: AuthedRequest): Promise<ParticipantAccess> {
    const user = req.user;
    if (!user?.username) throw new UnauthorizedException();
    return this.service.getMyAccess({ username: user.username, role: user.role });
  }
}
