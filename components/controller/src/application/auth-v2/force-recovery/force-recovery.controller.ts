import { BadRequestException, Body, Controller, Param, Post, Req, UnauthorizedException, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { AuthorizationGuard } from '../authorization/authorization.guard';
import { CheckAbility } from '../authorization/check-ability.decorator';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { ForceRecoveryService, type ForceRecoveryAuthorization } from './force-recovery.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string; role?: string };
}

/**
 * Force-recovery (CoopID, Story 6.9). Председатель (capability `create CriticalAction`)
 * запрашивает согласие пайщика и авторизует сброс; пайщик подтверждает согласие по
 * magic-link без auth-guard (доступ мог быть утрачен). Гейт — в сервисе.
 */
@Controller('coop/force-recovery')
@UseFilters(AuthV2ExceptionFilter)
export class ForceRecoveryController {
  constructor(private readonly service: ForceRecoveryService) {}

  @Post('request-consent')
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('create', 'CriticalAction')
  async requestConsent(@Body() body: { targetId: string }, @Req() req: AuthedRequest): Promise<{ status: 'requested' }> {
    const initiatorId = req.user?.username;
    if (!initiatorId) throw new UnauthorizedException();
    if (!body?.targetId) throw new BadRequestException('targetId обязателен');
    await this.service.requestConsent(body.targetId, initiatorId, req.ip ?? null);
    return { status: 'requested' };
  }

  @Post('consent/:token')
  async grantConsent(@Param('token') token: string, @Req() req: AuthedRequest): Promise<{ status: 'granted'; targetId: string }> {
    const { targetId } = await this.service.grantConsent(token, req.ip ?? null);
    return { status: 'granted', targetId };
  }

  @Post('authorize')
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('create', 'CriticalAction')
  async authorize(
    @Body() body: { targetId: string; assemblyDecisionTxId?: string; criticalActionId?: string },
    @Req() req: AuthedRequest,
  ): Promise<ForceRecoveryAuthorization> {
    const initiatorId = req.user?.username;
    if (!initiatorId) throw new UnauthorizedException();
    if (!body?.targetId) throw new BadRequestException('targetId обязателен');
    return this.service.authorize({
      targetId: body.targetId,
      initiatorId,
      assemblyDecisionTxId: body.assemblyDecisionTxId,
      criticalActionId: body.criticalActionId,
      ip: req.ip ?? null,
    });
  }
}
