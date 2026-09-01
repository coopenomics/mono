import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthRateLimit } from '../rate-limit/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../rate-limit/auth-rate-limit.guard';
import { ESCALATING_LOCKOUT, LOGIN_ACCOUNT_RULE, LOGIN_IP_RULE, MAGIC_LINK_RULE } from '../rate-limit/auth-rate-limit.types';
import { RecoveryService } from './recovery.service';
import { RecoveryConfirmService } from './recovery-confirm.service';
import { OfflineRecoveryService } from './offline-recovery.service';

interface RecoveryRequestBody {
  email?: string;
}

interface OfflineCodeBody {
  code?: string;
}

interface RecoveryConfirmBody {
  token?: string;
  code?: string;
  public_key?: string;
  vault?: EncryptedVaultBlob;
  password?: string;
}

interface RecoveryCancelBody {
  token?: string;
}

const TOO_MANY_RECOVERY = {
  code: AuthV2ErrorCode.TooManyRecoveryAttempts,
  message: 'Слишком много попыток подтверждения. Попробуйте позже.',
};

/**
 * Инициация восстановления доступа magic-link'ом (CoopID, Story 3.1).
 *
 * `POST /coop/recovery/request` принимает email и всегда отвечает `202` —
 * существование адреса наружу не раскрывается (анти-enumeration). Письмо с
 * одноразовой ссылкой уходит только реально зарегистрированному пайщику с
 * подтверждённым email. Rate-limit 3/час по email и по IP (`MAGIC_LINK_RULE`,
 * NFR10); превышение → `429 TooManyRecoveryAttempts` (отдельный код — AC
 * различает его и общий `too_many_attempts` контура входа).
 */
@Controller('coop/recovery')
export class RecoveryController {
  constructor(
    private readonly recovery: RecoveryService,
    private readonly confirmService: RecoveryConfirmService,
    private readonly offlineRecovery: OfflineRecoveryService,
  ) {}

  @Post('request')
  @HttpCode(202)
  @UseFilters(AuthV2ExceptionFilter)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({
    ip: { ...MAGIC_LINK_RULE, escalating: ESCALATING_LOCKOUT },
    account: { ...MAGIC_LINK_RULE, escalating: ESCALATING_LOCKOUT, key: (req) => keyFromEmail(req) },
    error: {
      code: AuthV2ErrorCode.TooManyRecoveryAttempts,
      message: 'Слишком много запросов на восстановление. Попробуйте позже.',
    },
  })
  async request(@Body() body: RecoveryRequestBody, @Req() req: Request): Promise<void> {
    const email = body?.email;
    if (!email || typeof email !== 'string') throw new BadRequestException('Требуется email');
    // Исход константен (всегда 202): сервис сам решает, слать письмо или нет.
    await this.recovery.requestByEmail(email, req.ip ?? null);
  }

  /**
   * Альтернативный первый канал (Story 3.4): offline-код вместо email-magic-link.
   * При совпадении выдаёт recovery-токен — клиент несёт его в `/confirm` (TOTP +
   * новый материал, Story 3.2). Rate-limit per-IP и per-code (`MAGIC_LINK_RULE`).
   */
  @Post('offline-code')
  @HttpCode(200)
  @UseFilters(AuthV2ExceptionFilter)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({
    ip: { ...MAGIC_LINK_RULE, escalating: ESCALATING_LOCKOUT },
    account: { ...MAGIC_LINK_RULE, escalating: ESCALATING_LOCKOUT, key: (req) => codeFromBody(req) },
    error: TOO_MANY_RECOVERY,
  })
  async offlineCode(@Body() body: OfflineCodeBody, @Req() req: Request): Promise<{ recovery_token: string }> {
    const code = requireString(body?.code, 'code');
    const recovery_token = await this.offlineRecovery.requestByOfflineCode(code, req.ip ?? null);
    return { recovery_token };
  }

  /**
   * Двухканальное подтверждение (Story 3.2): magic-link токен + TOTP-код + новый
   * ключевой материал и пароль одним запросом. Rate-limit per-IP и per-token —
   * против brute-force TOTP при удержанной ссылке; превышение → `429`.
   */
  @Post('confirm')
  @HttpCode(200)
  @UseFilters(AuthV2ExceptionFilter)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({
    ip: { ...LOGIN_IP_RULE, escalating: ESCALATING_LOCKOUT },
    account: { ...LOGIN_ACCOUNT_RULE, escalating: ESCALATING_LOCKOUT, key: (req) => tokenFromBody(req) },
    error: TOO_MANY_RECOVERY,
  })
  async confirm(@Body() body: RecoveryConfirmBody, @Req() req: Request): Promise<{ username: string }> {
    const token = requireString(body?.token, 'token');
    const code = requireString(body?.code, 'code');
    const newPublicKey = requireString(body?.public_key, 'public_key');
    const newPassword = requireString(body?.password, 'password');
    const vaultBlob = body?.vault;
    if (!vaultBlob || typeof vaultBlob !== 'object') {
      throw new BadRequestException('Требуется зашифрованный vault-блоб');
    }
    // Возвращаем username (резолвнут из токена) — клиент скачает по нему новый
    // vault-блоб и расшифрует при повторном входе; отдельный whoami-by-token не нужен.
    return this.confirmService.confirm(
      { token, code, newPublicKey, vaultBlob, newPassword },
      req.ip ?? null,
    );
  }

  /** Отмена восстановления (Story 3.2): сжигает magic-link токен. */
  @Post('cancel')
  @HttpCode(202)
  @UseFilters(AuthV2ExceptionFilter)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({
    ip: { ...LOGIN_IP_RULE, escalating: ESCALATING_LOCKOUT },
    account: { ...LOGIN_ACCOUNT_RULE, escalating: ESCALATING_LOCKOUT, key: (req) => tokenFromBody(req) },
    error: TOO_MANY_RECOVERY,
  })
  async cancel(@Body() body: RecoveryCancelBody, @Req() req: Request): Promise<void> {
    const token = requireString(body?.token, 'token');
    await this.confirmService.cancel(token, req.ip ?? null);
  }
}

/** Достать непустую строку из тела или 400. */
function requireString(value: unknown, field: string): string {
  if (!value || typeof value !== 'string') throw new BadRequestException(`Требуется ${field}`);
  return value;
}

/** per-token ключ rate-limit для confirm/cancel. */
function tokenFromBody(req: Request): string | null {
  const token = (req.body as RecoveryConfirmBody | undefined)?.token;
  return token && typeof token === 'string' ? token : null;
}

/** per-code ключ rate-limit для offline-code (нормализованный код). */
function codeFromBody(req: Request): string | null {
  const code = (req.body as OfflineCodeBody | undefined)?.code;
  return code && typeof code === 'string' ? code.replace(/\D/g, '') : null;
}

/** per-account ключ rate-limit = нормализованный email (совпадает с ключом lookup'а). */
function keyFromEmail(req: Request): string | null {
  const email = (req.body as RecoveryRequestBody | undefined)?.email;
  return email && typeof email === 'string' ? normalizeUserEmail(email) : null;
}
