import { Controller, Delete, Get, HttpCode, Param, Req, UnauthorizedException, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import type { ActiveSession } from '~/domain/auth-v2/sessions/session.types';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { SessionsService } from './sessions.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string };
}

/** Заголовок, которым SPA передаёт свой refresh-токен, чтобы пометить текущую сессию в списке. */
const CURRENT_SESSION_HEADER = 'x-coop-refresh-token';

/**
 * Активные сессии пайщика (Story 3.7) под `HttpJwtAuthGuard` — subject = `user.id`.
 * GET — список устройств; DELETE /:id — отозвать одну; DELETE — отозвать все.
 */
@Controller('coop/sessions')
@UseFilters(AuthV2ExceptionFilter)
@UseGuards(HttpJwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** Список активных сессий; текущая помечается, если передан X-Coop-Refresh-Token. */
  @Get()
  async list(@Req() req: AuthedRequest): Promise<{ sessions: ActiveSession[] }> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    const current = req.header(CURRENT_SESSION_HEADER) ?? null;
    return { sessions: await this.sessions.list(user.id, current) };
  }

  /** Завершить конкретную сессию. */
  @Delete(':id')
  @HttpCode(204)
  async revoke(@Param('id') id: string, @Req() req: AuthedRequest): Promise<void> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    await this.sessions.revoke(user.id, id, req.ip ?? null);
  }

  /** Завершить все сессии пайщика. */
  @Delete()
  async revokeAll(@Req() req: AuthedRequest): Promise<{ revoked: number }> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    return this.sessions.revokeAll(user.id, req.ip ?? null);
  }
}
