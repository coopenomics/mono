import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { isRecoveryStrategy, RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { RecoveryStrategyService } from './recovery-strategy.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string };
}

interface SetStrategyBody {
  strategy?: string;
  code?: string;
}

/**
 * Настройка стратегии восстановления (CoopID, Story 3.5). Под `HttpJwtAuthGuard` —
 * для текущего залогиненного пайщика (subject = `user.id`). Смена требует step-up
 * второго фактора (TOTP) — см. отступление от AC в спеке.
 */
@Controller('coop/recovery/strategy')
@UseFilters(AuthV2ExceptionFilter)
@UseGuards(HttpJwtAuthGuard)
export class RecoveryStrategyController {
  constructor(private readonly strategy: RecoveryStrategyService) {}

  /** Текущая стратегия пайщика. */
  @Get()
  async get(@Req() req: AuthedRequest): Promise<{ strategy: RecoveryStrategy }> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    return { strategy: await this.strategy.getStrategy(user.id) };
  }

  /** Сменить стратегию (требует TOTP-код step-up). */
  @Post()
  @HttpCode(204)
  async set(@Body() body: SetStrategyBody, @Req() req: AuthedRequest): Promise<void> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    if (!isRecoveryStrategy(body?.strategy)) throw new BadRequestException('Недопустимая стратегия восстановления');
    if (!body?.code || typeof body.code !== 'string') throw new BadRequestException('Требуется code');
    await this.strategy.setStrategy(user.id, body.strategy, body.code, req.ip ?? null);
  }
}
