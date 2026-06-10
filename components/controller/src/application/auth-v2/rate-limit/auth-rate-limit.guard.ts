import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { RATE_LIMIT_STORAGE } from '~/domain/auth-v2/ports/rate-limit-storage.port';
import { AUTH_RATE_LIMIT_METADATA, type AuthRateLimitConfig, type RateLimitRule } from './auth-rate-limit.types';

/**
 * Двухключевой rate-limit контура auth-v2 (CoopID, Story 9.1). На endpoint'ах с
 * `@AuthRateLimit(...)` проверяет ДВА независимых счётчика: per-IP и (если
 * идентификатор доступен) per-account. Превышение ЛЮБОГО → `AuthV2Error(TooManyAttempts)`,
 * который контурный `AuthV2ExceptionFilter` (Story 1.11) отдаёт как `429` в формате OAuth2.
 *
 * Намеренно НЕ использует глобальный список throttlers `ThrottlerModule.forRoot`
 * (он применился бы ко всем guarded-роутам приложения) — guard сам зовёт
 * `storage.increment` для своих ключей. Хранилище — Redis (переживает рестарт,
 * общее для нескольких инстансов). Блок выставляется на длину окна (`blockDuration = ttl`);
 * нарастающий (escalating) lockout — Story 3.12.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMIT_STORAGE) private readonly storage: ThrottlerStorage,
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
    // Инкрементируем оба счётчика (обе попытки должны учитываться), затем решаем.
    for (const { name, tracker, rule } of checks) {
      const record = await this.storage.increment(tracker, rule.ttl, rule.limit, rule.ttl, name);
      if (record.isBlocked || record.totalHits > rule.limit) exceeded = true;
    }

    if (exceeded) {
      // Кастомный код эндпоинта (напр. recovery → TooManyRecoveryAttempts) либо дефолт.
      throw new AuthV2Error(
        config.error?.code ?? AuthV2ErrorCode.TooManyAttempts,
        config.error?.message ?? 'Слишком много попыток. Подождите и повторите позже.',
      );
    }
    return true;
  }
}
