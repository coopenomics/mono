import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { LOGIN_ACCOUNT_RULE, LOGIN_IP_RULE, type AuthRateLimitConfig } from './auth-rate-limit.types';

function record(totalHits: number, isBlocked = false): ThrottlerStorageRecord {
  return { totalHits, timeToExpire: 1000, isBlocked, timeToBlockExpire: isBlocked ? 1000 : 0 };
}

function makeContext(config: AuthRateLimitConfig | undefined, req: { ip?: string; params?: Record<string, string> }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeGuard(config: AuthRateLimitConfig | undefined, increment: jest.Mock) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(config) } as unknown as Reflector;
  const storage = { increment } as unknown as ThrottlerStorage;
  return { guard: new AuthRateLimitGuard(reflector, storage), increment };
}

const TWO_KEY: AuthRateLimitConfig = {
  ip: LOGIN_IP_RULE,
  account: { ...LOGIN_ACCOUNT_RULE, key: (req) => req.params?.subject_id },
};

describe('AuthRateLimitGuard (Story 9.1)', () => {
  it('без @AuthRateLimit-конфига пропускает и не трогает хранилище', async () => {
    const { guard, increment } = makeGuard(undefined, jest.fn());
    const ctx = makeContext(undefined, { ip: '1.2.3.4' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(increment).not.toHaveBeenCalled();
  });

  it('оба ключа под лимитом → пропуск; инкрементированы и ip, и account', async () => {
    const increment = jest.fn().mockResolvedValue(record(1));
    const { guard } = makeGuard(TWO_KEY, increment);
    const ctx = makeContext(TWO_KEY, { ip: '1.2.3.4', params: { subject_id: 'ant' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(increment).toHaveBeenCalledTimes(2);
    expect(increment).toHaveBeenCalledWith('1.2.3.4', LOGIN_IP_RULE.ttl, LOGIN_IP_RULE.limit, LOGIN_IP_RULE.ttl, 'ip');
    expect(increment).toHaveBeenCalledWith('ant', LOGIN_ACCOUNT_RULE.ttl, LOGIN_ACCOUNT_RULE.limit, LOGIN_ACCOUNT_RULE.ttl, 'account');
  });

  it('превышение IP-лимита → 429 TooManyAttempts', async () => {
    const increment = jest.fn().mockResolvedValue(record(LOGIN_IP_RULE.limit + 1));
    const { guard } = makeGuard({ ip: LOGIN_IP_RULE }, increment);
    const ctx = makeContext({ ip: LOGIN_IP_RULE } as AuthRateLimitConfig, { ip: '1.2.3.4' });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      code: AuthV2ErrorCode.TooManyAttempts,
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AuthV2Error);
  });

  it('превышение account-лимита → 429 (ip под лимитом)', async () => {
    const increment = jest.fn().mockImplementation((_tracker, _ttl, _limit, _block, name) =>
      Promise.resolve(name === 'account' ? record(LOGIN_ACCOUNT_RULE.limit + 1) : record(1)),
    );
    const { guard } = makeGuard(TWO_KEY, increment);
    const ctx = makeContext(TWO_KEY, { ip: '1.2.3.4', params: { subject_id: 'ant' } });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ code: AuthV2ErrorCode.TooManyAttempts });
  });

  it('isBlocked (в окне блока) → 429 даже если totalHits в пределах', async () => {
    const increment = jest.fn().mockResolvedValue(record(1, true));
    const { guard } = makeGuard({ ip: LOGIN_IP_RULE }, increment);
    const ctx = makeContext({ ip: LOGIN_IP_RULE } as AuthRateLimitConfig, { ip: '1.2.3.4' });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ code: AuthV2ErrorCode.TooManyAttempts });
  });

  it('account-id не извлекаем → работает только per-IP ключ', async () => {
    const increment = jest.fn().mockResolvedValue(record(1));
    const { guard } = makeGuard(TWO_KEY, increment);
    // params без subject_id → account.key вернёт undefined
    const ctx = makeContext(TWO_KEY, { ip: '1.2.3.4', params: {} });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(increment).toHaveBeenCalledTimes(1);
    expect(increment).toHaveBeenCalledWith('1.2.3.4', LOGIN_IP_RULE.ttl, LOGIN_IP_RULE.limit, LOGIN_IP_RULE.ttl, 'ip');
  });

  it('нет req.ip → трекер "unknown" (не падает)', async () => {
    const increment = jest.fn().mockResolvedValue(record(1));
    const { guard } = makeGuard({ ip: LOGIN_IP_RULE }, increment);
    const ctx = makeContext({ ip: LOGIN_IP_RULE } as AuthRateLimitConfig, {});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(increment).toHaveBeenCalledWith('unknown', LOGIN_IP_RULE.ttl, LOGIN_IP_RULE.limit, LOGIN_IP_RULE.ttl, 'ip');
  });

  it('кастомный error-код в конфиге (Story 3.1) → бросается он, не дефолт', async () => {
    const increment = jest.fn().mockResolvedValue(record(LOGIN_IP_RULE.limit + 1));
    const cfg: AuthRateLimitConfig = {
      ip: LOGIN_IP_RULE,
      error: { code: AuthV2ErrorCode.TooManyRecoveryAttempts, message: 'recovery limit' },
    };
    const { guard } = makeGuard(cfg, increment);
    const ctx = makeContext(cfg, { ip: '1.2.3.4' });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      code: AuthV2ErrorCode.TooManyRecoveryAttempts,
      message: 'recovery limit',
    });
  });
});
