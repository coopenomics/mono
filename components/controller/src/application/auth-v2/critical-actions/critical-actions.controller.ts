import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { CriticalActionType, type PendingCriticalAction } from '~/domain/auth-v2/ports/pending-critical-actions.port';
import { AuthorizationGuard } from '../authorization/authorization.guard';
import { CheckAbility } from '../authorization/check-ability.decorator';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { CriticalActionsService, type CriticalActionAuditEntry } from './critical-actions.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string; role?: string };
}

interface InitiateBody {
  actionType: CriticalActionType;
  targetId: string;
  payload?: Record<string, unknown>;
}

/**
 * Critical actions (CoopID, Story 6.8) — первый боевой `@CheckAbility` + `AuthorizationGuard`
 * (Story 6.4/6.5): инициация под capability `create CriticalAction` (председатель),
 * подтверждение под `confirm CriticalAction` (член совета). Различимость подписантов,
 * кворум и окно — в сервисе.
 */
@Controller('coop/critical-actions')
@UseFilters(AuthV2ExceptionFilter)
export class CriticalActionsController {
  constructor(private readonly service: CriticalActionsService) {}

  @Post()
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('create', 'CriticalAction')
  async initiate(@Body() body: InitiateBody, @Req() req: AuthedRequest): Promise<PendingCriticalAction> {
    const actorId = req.user?.username;
    if (!actorId) throw new UnauthorizedException();
    if (!(Object.values(CriticalActionType) as string[]).includes(body?.actionType))
      throw new BadRequestException('Недопустимый тип критического действия');
    if (!body?.targetId) throw new BadRequestException('targetId обязателен');
    return this.service.initiate({
      actionType: body.actionType,
      actorId,
      targetId: body.targetId,
      payload: body.payload,
    });
  }

  @Post(':id/confirm')
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('confirm', 'CriticalAction')
  async confirm(@Param('id') id: string, @Req() req: AuthedRequest): Promise<PendingCriticalAction> {
    const confirmerId = req.user?.username;
    if (!confirmerId) throw new UnauthorizedException();
    return this.service.confirm(id, confirmerId);
  }

  /**
   * Audit-trail критических действий пайщика (Story 6.10): полная атрибуция
   * (инициатор + подтверждающие совета + payload_hash) для контролирующего органа.
   * Право чтения — `read CriticalAction` (член совета / председатель).
   */
  @Get('audit-trail/:targetId')
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('read', 'CriticalAction')
  async auditTrail(@Param('targetId') targetId: string): Promise<CriticalActionAuditEntry[]> {
    if (!targetId) throw new BadRequestException('targetId обязателен');
    return this.service.getAuditTrail(targetId);
  }
}
