import { BadRequestException, Body, Controller, HttpCode, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';
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
  /** Новый публичный ключ (запрос ротации: старый ключ будет погашен on-chain). */
  new_public_key?: string;
  /** Зашифрованный паролём блоб с НОВЫМ приватным ключом (обязателен при ротации). */
  vault?: Record<string, unknown>;
}

/**
 * Миграция действующего пайщика «ключ → пароль» (Story 11.4). Бессессионный
 * эндпоинт: владение ключом доказывается подписью метки времени против COOPOS,
 * authentik-сессия не требуется (у мигранта ещё нет пароля).
 *
 * С `new_public_key` + `vault` выполняется ротация ключа: подпись биндит новый
 * pubkey (см. canonicalMigrationMessage), сервер сохраняет блоб и гасит старый
 * ключ через `registrator::changekey`. Без них — старое поведение: шифрование
 * текущего WIF в vault делает клиент после успеха (SDK `migrate`).
 */
@Controller('coop/migration')
@UseFilters(AuthV2ExceptionFilter)
export class MigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({
    ip: LOGIN_IP_RULE,
    // per-account ключ — email из тела (цель brute-force подписей по аккаунту).
    account: { ...LOGIN_ACCOUNT_RULE, key: (req: Request) => (req.body as MigrateBody)?.email ?? '' },
  })
  async migrate(@Body() body: MigrateBody, @Req() req: Request): Promise<{ username: string; rotated: boolean }> {
    const email = body?.email;
    const timestamp = body?.timestamp;
    const signature = body?.signature;
    const newPassword = body?.new_password;
    if (!email || !timestamp || !signature || !newPassword)
      throw new BadRequestException('Требуются email, timestamp, signature, new_password');

    const newPublicKey = typeof body?.new_public_key === 'string' && body.new_public_key ? body.new_public_key : null;
    const vaultBlob = body?.vault && typeof body.vault === 'object' ? (body.vault as unknown as EncryptedVaultBlob) : null;
    if (newPublicKey && !vaultBlob)
      throw new BadRequestException('Ротация требует зашифрованный vault-блоб с новым ключом');

    // username возвращается клиенту как subject_id vault'а (SDK saveToVault).
    return this.migration.migrate({ email, timestamp, signature, newPassword, newPublicKey, vaultBlob, ip: req.ip ?? null });
  }
}
