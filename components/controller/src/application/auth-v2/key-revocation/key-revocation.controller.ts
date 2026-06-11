import { BadRequestException, Body, Controller, Post, Req, UnauthorizedException, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { AuthorizationGuard } from '../authorization/authorization.guard';
import { CheckAbility } from '../authorization/check-ability.decorator';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { KeyRevocationService, type RevokeKeyResult } from './key-revocation.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string; role?: string };
}

interface RevokeBody {
  targetId: string;
  reason: string;
}

/**
 * Manual revoke (CoopID, Story 4.7). Председатель отзывает скомпрометированный ключ
 * пайщика. Право — `update Participant` (председатель администрирует security-состояние
 * пайщика; отдельной CASL-способности `revoke` не вводим — матрица не расширяется).
 * Сессии, pending-state и аудит — в сервисе.
 */
@Controller('coop/keys')
@UseFilters(AuthV2ExceptionFilter)
export class KeyRevocationController {
  constructor(private readonly service: KeyRevocationService) {}

  @Post('revoke')
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('update', 'Participant')
  async revoke(@Body() body: RevokeBody, @Req() req: AuthedRequest): Promise<RevokeKeyResult> {
    const chairmanId = req.user?.username;
    if (!chairmanId) throw new UnauthorizedException();
    if (!body?.targetId) throw new BadRequestException('targetId обязателен');
    if (!body?.reason) throw new BadRequestException('reason обязателен (обоснование отзыва)');
    return this.service.revoke({ targetId: body.targetId, reason: body.reason, chairmanId, ip: req.ip ?? null });
  }
}
