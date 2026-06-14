import { BadRequestException, Body, Controller, HttpCode, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthRateLimit } from '../rate-limit/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../rate-limit/auth-rate-limit.guard';
import { LOGIN_ACCOUNT_RULE, LOGIN_IP_RULE } from '../rate-limit/auth-rate-limit.types';
import { MigrationService } from './migration.service';

interface MigrateBody {
  email?: string;
  timestamp?: string;
  signature?: string;
  new_password?: string;
}

/**
 * Миграция действующего пайщика «ключ → пароль» (Story 11.4). Бессессионный
 * эндпоинт: владение ключом доказывается подписью метки времени против COOPOS,
 * authentik-сессия не требуется (у мигранта ещё нет пароля). Шифрование WIF в
 * vault новым паролём делает клиент после успеха (SDK `migrate`).
 */
@Controller('coop/migration')
@UseFilters(AuthV2ExceptionFilter)
export class MigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Post()
  @HttpCode(204)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({
    ip: LOGIN_IP_RULE,
    // per-account ключ — email из тела (цель brute-force подписей по аккаунту).
    account: { ...LOGIN_ACCOUNT_RULE, key: (req: Request) => (req.body as MigrateBody)?.email ?? '' },
  })
  async migrate(@Body() body: MigrateBody, @Req() req: Request): Promise<void> {
    const email = body?.email;
    const timestamp = body?.timestamp;
    const signature = body?.signature;
    const newPassword = body?.new_password;
    if (!email || !timestamp || !signature || !newPassword)
      throw new BadRequestException('Требуются email, timestamp, signature, new_password');

    await this.migration.migrate({ email, timestamp, signature, newPassword, ip: req.ip ?? null });
  }
}
