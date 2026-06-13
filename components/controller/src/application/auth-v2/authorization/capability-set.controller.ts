import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import type { CapabilitySet, CapabilitySetAssignment } from '~/domain/auth-v2/ports/capability-sets.port';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthorizationGuard } from './authorization.guard';
import { CheckAbility } from './check-ability.decorator';
import { CapabilitySetService } from './capability-set.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string; role?: string };
}

interface AssignBody {
  username: string;
  setKey: string;
  expiresAt?: string | null;
}

interface RevokeBody {
  username: string;
  setKey: string;
}

/**
 * Назначаемые наборы возможностей (Story 6.11) — бэкенд страницы «Персонал» стола
 * совета. Управляет председатель: `@CheckAbility('manage','CapabilitySet')` на
 * мутациях, `read` на каталоге/просмотре (председатель имеет manage → покрывает read).
 * Самой страницы пока нет — эндпоинты готовят управление этими правами.
 */
@Controller('coop/capability-sets')
@UseFilters(AuthV2ExceptionFilter)
export class CapabilitySetController {
  constructor(private readonly service: CapabilitySetService) {}

  @Get()
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('read', 'CapabilitySet')
  async list(): Promise<CapabilitySet[]> {
    return this.service.listSets();
  }

  @Get('participant/:username')
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('read', 'CapabilitySet')
  async forParticipant(@Param('username') username: string): Promise<CapabilitySetAssignment[]> {
    if (!username) throw new BadRequestException('username обязателен');
    return this.service.listForParticipant(username);
  }

  @Post('assign')
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('manage', 'CapabilitySet')
  async assign(@Body() body: AssignBody, @Req() req: AuthedRequest): Promise<{ ok: true }> {
    const grantedBy = req.user?.username;
    if (!grantedBy) throw new UnauthorizedException();
    if (!body?.username || !body?.setKey) throw new BadRequestException('username и setKey обязательны');
    await this.service.assign({ username: body.username, setKey: body.setKey, grantedBy, expiresAt: body.expiresAt ?? null });
    return { ok: true };
  }

  @Post('revoke')
  @UseGuards(HttpJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('manage', 'CapabilitySet')
  async revoke(@Body() body: RevokeBody, @Req() req: AuthedRequest): Promise<{ ok: true }> {
    const revokedBy = req.user?.username;
    if (!revokedBy) throw new UnauthorizedException();
    if (!body?.username || !body?.setKey) throw new BadRequestException('username и setKey обязательны');
    await this.service.revoke(body.username, body.setKey, revokedBy);
    return { ok: true };
  }
}
