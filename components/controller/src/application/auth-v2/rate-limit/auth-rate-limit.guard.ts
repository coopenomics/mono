import { createHash } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { RATE_LIMIT_STORAGE, type IEscalatingRateLimitStorage } from '~/domain/auth-v2/ports/rate-limit-storage.port';
import { AuditService } from '../audit/audit.service';
import { AUTH_RATE_LIMIT_METADATA, type AuthRateLimitConfig, type RateLimitRule } from './auth-rate-limit.types';

/** Переход в блок, замеченный этим запросом — для одноразовой audit-записи. */
interface LockoutEvent {
  scope: string;
  tracker: string;
  strike: number;
  lockoutMs: number;
}

/**
 * Двухключевой rate-limit контура auth-v2 (CoopID, Story 9.1). На endpoint'ах с
 * `@AuthRateLimit(...)` проверяет ДВА независимых счётчика: per-IP и (если
 * идентификатор доступен) per-account. Превышение ЛЮБОГО → `AuthV2Error(TooManyAttempts)`,
 * который контурный `AuthV2ExceptionFilter` (Story 1.11) отдаёт как `429` в формате OAuth2.
 *
 * Намеренно НЕ использует глобальный список throttlers `ThrottlerModule.forRoot`
 * (он применился бы ко всем guarded-роутам приложения) — guard сам зовёт
 * `storage.increment` для своих ключей. Хранилище — Redis (переживает рестарт,
 * общее для нескольких инстансов).
 *
 * Нарастающая блокировка (Story 3.12, NFR13): если правило несёт `escalating`,
 * блок ставится не на длину окна, а на тир по номеру страйка трекера (1ч→4ч→12ч→24ч);
 * переход в блок пишется в `audit_events` (`coopid.security.account_locked`,
 * best-effort). Трекер хэшируется перед записью — recovery-токен/email в аудит не
 * утекают (инвариант: `sha256`, как side-store метаданных сессий в Story 3.7).
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AuthRateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMIT_STORAGE) private readonly storage: ThrottlerStorage,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<AuthRateLimitConfig | undefined>(AUTH_RATE_LIMIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!config) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? 'unknown';

    // Собираем активные ключи: per-IP всегда; per-account — только если извлекаем.
    const checks: Array<{ name: string; tracker: string; rule: RateLimitRule }> = [
      { name: 'ip', tracker: ip, rule: config.ip },
    ];
    if (config.account) {
      const accountId = config.account.key(req);
      if (accountId) checks.push({ name: 'account', tracker: accountId, rule: config.account });
    }

    let exceeded = false;
    const lockouts: LockoutEvent[] = [];
    // Инкрементируем оба счётчика (обе попытки должны учитываться), затем решаем.
    for (const { name, tracker, rule } of checks) {
      if (rule.escalating && typeof (this.storage as Partial<IEscalatingRateLimitStorage>).incrementEscalating === 'function') {
        const record = await (this.storage as IEscalatingRateLimitStorage).incrementEscalating(
          tracker,
          rule.ttl,
          rule.limit,
          rule.escalating.tiers,
          rule.escalating.memoryTtl,
          name,
        );
        if (record.isBlocked || record.totalHits > rule.limit) exceeded = true;
        if (record.newlyBlocked) lockouts.push({ scope: name, tracker, strike: record.strike, lockoutMs: record.timeToBlockExpire });
      } else {
        const record = await this.storage.increment(tracker, rule.ttl, rule.limit, rule.ttl, name);
        if (record.isBlocked || record.totalHits > rule.limit) exceeded = true;
      }
    }

    // AC 3.12: «все события lockout пишутся в audit_events». Best-effort — отказ
    // аудита не должен подменять 429 на 500 (блок уже выставлен в Redis).
    if (lockouts.length) await this.recordLockouts(lockouts, ip);

    if (exceeded) {
      // Кастомный код эндпоинта (напр. recovery → TooManyRecoveryAttempts) либо дефолт.
      throw new AuthV2Error(
        config.error?.code ?? AuthV2ErrorCode.TooManyAttempts,
        config.error?.message ?? 'Слишком много попыток. Подождите и повторите позже.',
      );
    }
    return true;
  }

  private async recordLockouts(lockouts: LockoutEvent[], ip: string): Promise<void> {
    if (!this.audit) return;
    for (const lock of lockouts) {
      try {
        await this.audit.record({
          event: 'coopid.security.account_locked',
          result: 'failure',
          ip,
          context: {
            scope: lock.scope,
            // Хэш, не сам трекер: per-account ключом может быть recovery-токен/email.
            tracker_hash: createHash('sha256').update(lock.tracker).digest('hex').slice(0, 16),
            strike: lock.strike,
            lockout_seconds: Math.round(lock.lockoutMs / 1000),
          },
        });
      } catch (e) {
        this.logger.warn(`audit account_locked не записан: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}
