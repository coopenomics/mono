import { createHash } from 'node:crypto';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { LoginFactorKind } from '~/domain/auth-v2/ports/login-challenge-store.port';
import type { LoginChallengeState } from '~/domain/auth-v2/ports/login-challenge-store.port';
import { LoginTwoFactorService } from './login-two-factor.service';

const USER = {
  id: 'user-uuid-1',
  username: 'ant',
  email: 'ant@example.com',
  is_email_verified: true,
  subscriber_id: 'sub-1',
};

function makeState(partial: Partial<LoginChallengeState> = {}): LoginChallengeState {
  return {
    subjectId: USER.id,
    sub: USER.username,
    factors: [LoginFactorKind.Totp],
    passed: [],
    emailCodeHash: null,
    emailSendCount: 0,
    ip: '1.2.3.4',
    userAgent: 'jest',
    acceptLanguage: null,
    degraded: false,
    ...partial,
  };
}

function setup(overrides: {
  settings?: { totpEnabled: boolean; emailEnabled: boolean } | null;
  totpEnrolled?: boolean;
  totpValid?: boolean;
  state?: LoginChallengeState | null;
  attempts?: number;
  grace?: string | null;
  resendAcquired?: boolean;
  user?: Record<string, unknown> | null;
} = {}) {
  const factorsRepo = {
    get: jest.fn().mockResolvedValue(
      overrides.settings === undefined
        ? { subjectId: USER.id, totpEnabled: true, emailEnabled: false }
        : overrides.settings
        ? { subjectId: USER.id, ...overrides.settings }
        : null,
    ),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const challenges = {
    create: jest.fn().mockResolvedValue('challenge-token-1'),
    get: jest.fn().mockResolvedValue(overrides.state === undefined ? makeState() : overrides.state),
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    bumpAttempts: jest.fn().mockResolvedValue(overrides.attempts ?? 1),
    tryAcquireResend: jest.fn().mockResolvedValue(overrides.resendAcquired ?? true),
  };
  const twoFactor = {
    isEnabled: jest.fn().mockResolvedValue(overrides.totpEnrolled ?? true),
    verify: jest.fn().mockResolvedValue(overrides.totpValid ?? true),
  };
  const users = {
    findUserById: jest.fn().mockResolvedValue(overrides.user === undefined ? USER : overrides.user),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const redis = {
    consumeSingleUse: jest.fn().mockResolvedValue(overrides.grace ?? null),
    setSingleUse: jest.fn().mockResolvedValue(true),
    publish: jest.fn(),
    subscribe: jest.fn(),
    hgetall: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const metrics = { loginAttempt: jest.fn(), loginSuccess: jest.fn(), loginError: jest.fn() };
  const sessionIssue = {
    issue: jest.fn().mockResolvedValue({ access_token: 'access-jwt', refresh_token: 'refresh-jwt' }),
  };
  const service = new LoginTwoFactorService(
    factorsRepo as any,
    challenges as any,
    twoFactor as any,
    users as any,
    notifications as any,
    redis as any,
    audit as any,
    metrics as any,
    sessionIssue as any,
  );
  return { service, factorsRepo, challenges, twoFactor, users, notifications, redis, audit, metrics, sessionIssue };
}

describe('LoginTwoFactorService (2FA-вход)', () => {
  describe('maybeBeginChallenge', () => {
    it('без настроек факторов → null (вход финализируется сразу)', async () => {
      const { service, challenges } = setup({ settings: null });
      const result = await service.maybeBeginChallenge({
        user: USER, sub: USER.username, ip: null, userAgent: null, acceptLanguage: null, degraded: false,
      });
      expect(result).toBeNull();
      expect(challenges.create).not.toHaveBeenCalled();
    });

    it('включён TOTP → challenge с фактором totp, email-код не отправляется', async () => {
      const { service, notifications } = setup();
      const result = await service.maybeBeginChallenge({
        user: USER, sub: USER.username, ip: null, userAgent: null, acceptLanguage: null, degraded: false,
      });
      expect(result).toEqual({
        second_factor_required: true,
        challenge_token: 'challenge-token-1',
        factors: [LoginFactorKind.Totp],
      });
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('оба фактора → очередь totp → email; email-код НЕ отправлен до прохождения totp', async () => {
      const { service, notifications, challenges } = setup({ settings: { totpEnabled: true, emailEnabled: true } });
      const result = await service.maybeBeginChallenge({
        user: USER, sub: USER.username, ip: null, userAgent: null, acceptLanguage: null, degraded: false,
      });
      expect(result?.factors).toEqual([LoginFactorKind.Totp, LoginFactorKind.Email]);
      expect(notifications.notify).not.toHaveBeenCalled();
      const state = challenges.create.mock.calls[0][0] as LoginChallengeState;
      expect(state.emailCodeHash).toBeNull();
    });

    it('только email → код отправляется сразу при создании challenge', async () => {
      const { service, notifications, challenges } = setup({ settings: { totpEnabled: false, emailEnabled: true } });
      await service.maybeBeginChallenge({
        user: USER, sub: USER.username, ip: null, userAgent: null, acceptLanguage: null, degraded: false,
      });
      expect(notifications.notify).toHaveBeenCalledTimes(1);
      const state = challenges.create.mock.calls[0][0] as LoginChallengeState;
      expect(state.emailCodeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(state.emailSendCount).toBe(1);
    });

    it('TOTP включён настройкой, но секрет не подключён → фактор пропускается (защита от локаута)', async () => {
      const { service } = setup({ totpEnrolled: false });
      const result = await service.maybeBeginChallenge({
        user: USER, sub: USER.username, ip: null, userAgent: null, acceptLanguage: null, degraded: false,
      });
      expect(result).toBeNull();
    });

    it('post-recovery grace потребляется single-use → challenge не создаётся', async () => {
      const { service, challenges, redis } = setup({ grace: '1' });
      const result = await service.maybeBeginChallenge({
        user: USER, sub: USER.username, ip: null, userAgent: null, acceptLanguage: null, degraded: false,
      });
      expect(result).toBeNull();
      expect(redis.consumeSingleUse).toHaveBeenCalledWith(`coopid:login2fa:grace:${USER.id}`);
      expect(challenges.create).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('неизвестный/истёкший challenge → LoginChallengeExpired', async () => {
      const { service } = setup({ state: null });
      await expect(service.confirm({ token: 'x', code: '123456', ip: null })).rejects.toMatchObject({
        code: AuthV2ErrorCode.LoginChallengeExpired,
      });
    });

    it('верный TOTP на единственном факторе → challenge сожжён, токены выпущены', async () => {
      const { service, challenges, sessionIssue, metrics } = setup();
      const result = await service.confirm({ token: 't', code: '123456', ip: null });
      expect(challenges.delete).toHaveBeenCalledWith('t');
      expect(sessionIssue.issue).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER.id, sub: USER.username }),
      );
      expect(metrics.loginSuccess).toHaveBeenCalled();
      expect(result).toMatchObject({ access_token: 'access-jwt' });
    });

    it('неверный код → InvalidTwoFactorCode, счётчик попыток атомарно растёт', async () => {
      const { service, challenges, sessionIssue } = setup({ totpValid: false });
      await expect(service.confirm({ token: 't', code: '000000', ip: null })).rejects.toMatchObject({
        code: AuthV2ErrorCode.InvalidTwoFactorCode,
      });
      expect(challenges.bumpAttempts).toHaveBeenCalledWith('t', LoginFactorKind.Totp, expect.any(Number));
      expect(sessionIssue.issue).not.toHaveBeenCalled();
    });

    it('пятый неверный код → challenge сожжён, TooManyAttempts (перебор упирается в новый вход)', async () => {
      const { service, challenges } = setup({ totpValid: false, attempts: 5 });
      await expect(service.confirm({ token: 't', code: '000000', ip: null })).rejects.toMatchObject({
        code: AuthV2ErrorCode.TooManyAttempts,
      });
      expect(challenges.delete).toHaveBeenCalledWith('t');
    });

    it('totp пройден при очереди [totp, email] → прогресс + отправка email-кода, токенов нет', async () => {
      const state = makeState({ factors: [LoginFactorKind.Totp, LoginFactorKind.Email] });
      const { service, challenges, notifications, sessionIssue } = setup({ state });
      const result = await service.confirm({ token: 't', code: '123456', ip: null });
      expect(result).toEqual({ passed_factor: LoginFactorKind.Totp, next_factor: LoginFactorKind.Email });
      expect(notifications.notify).toHaveBeenCalledTimes(1);
      expect(challenges.put).toHaveBeenCalled();
      expect(sessionIssue.issue).not.toHaveBeenCalled();
    });

    it('email-код сверяется по sha256 (timing-safe), финал выпускает токены', async () => {
      const code = '654321';
      const state = makeState({
        factors: [LoginFactorKind.Email],
        emailCodeHash: createHash('sha256').update(code, 'utf8').digest('hex'),
        emailSendCount: 1,
      });
      const { service, sessionIssue } = setup({ state });
      const result = await service.confirm({ token: 't', code, ip: null });
      expect(sessionIssue.issue).toHaveBeenCalled();
      expect(result).toMatchObject({ access_token: 'access-jwt' });
    });

    it('degraded-контекст challenge протаскивается в финализацию', async () => {
      const state = makeState({ degraded: true, degradedReason: 'rpc_unavailable' as never });
      const { service, sessionIssue } = setup({ state });
      await service.confirm({ token: 't', code: '123456', ip: null });
      expect(sessionIssue.issue).toHaveBeenCalledWith(
        expect.objectContaining({ degraded: true, degradedReason: 'rpc_unavailable' }),
      );
    });
  });

  describe('resendEmailCode', () => {
    it('текущий фактор не email → InvalidCredentials', async () => {
      const { service } = setup();
      await expect(service.resendEmailCode('t', null)).rejects.toMatchObject({
        code: AuthV2ErrorCode.InvalidCredentials,
      });
    });

    it('троттл занят → TooManyAttempts, письмо не уходит', async () => {
      const state = makeState({ factors: [LoginFactorKind.Email], emailSendCount: 1 });
      const { service, notifications } = setup({ state, resendAcquired: false });
      await expect(service.resendEmailCode('t', null)).rejects.toMatchObject({
        code: AuthV2ErrorCode.TooManyAttempts,
      });
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('потолок отправок исчерпан → TooManyAttempts', async () => {
      const state = makeState({ factors: [LoginFactorKind.Email], emailSendCount: 5 });
      const { service } = setup({ state });
      await expect(service.resendEmailCode('t', null)).rejects.toMatchObject({
        code: AuthV2ErrorCode.TooManyAttempts,
      });
    });

    it('успех: новый код отправлен и состояние перезаписано', async () => {
      const state = makeState({ factors: [LoginFactorKind.Email], emailSendCount: 1, emailCodeHash: 'old'.padEnd(64, '0') });
      const { service, notifications, challenges } = setup({ state });
      await service.resendEmailCode('t', null);
      expect(notifications.notify).toHaveBeenCalledTimes(1);
      const saved = challenges.put.mock.calls[0][1] as LoginChallengeState;
      expect(saved.emailSendCount).toBe(2);
      expect(saved.emailCodeHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('attachFreshEmailCode (fail-closed)', () => {
    it('получатель недоступен (нет subscriber_id) → CooposDegraded, фактор НЕ пропускается', async () => {
      const state = makeState({ factors: [LoginFactorKind.Email] });
      const { service } = setup({
        state,
        settings: { totpEnabled: false, emailEnabled: true },
        user: { ...USER, subscriber_id: null },
      });
      await expect(
        service.maybeBeginChallenge({
          user: { ...USER, subscriber_id: 'sub-1' }, sub: USER.username, ip: null, userAgent: null, acceptLanguage: null, degraded: false,
        }),
      ).rejects.toMatchObject({ code: AuthV2ErrorCode.CooposDegraded });
    });

    it('сбой очереди уведомлений → CooposDegraded (не молчаливый пропуск фактора)', async () => {
      const { service, notifications } = setup({ settings: { totpEnabled: false, emailEnabled: true } });
      notifications.notify.mockRejectedValue(new Error('novu down'));
      await expect(
        service.maybeBeginChallenge({
          user: USER, sub: USER.username, ip: null, userAgent: null, acceptLanguage: null, degraded: false,
        }),
      ).rejects.toMatchObject({ code: AuthV2ErrorCode.CooposDegraded });
    });
  });

  describe('hasEnabledFactorSettings (гейт легаси-входа)', () => {
    it('true при включённом факторе даже без доступности (fail-closed)', async () => {
      const { service } = setup({ totpEnrolled: false });
      await expect(service.hasEnabledFactorSettings(USER.id)).resolves.toBe(true);
    });

    it('false без настроек', async () => {
      const { service } = setup({ settings: null });
      await expect(service.hasEnabledFactorSettings(USER.id)).resolves.toBe(false);
    });
  });

  it('grantGrace пишет single-use ключ с TTL', async () => {
    const { service, redis } = setup();
    await service.grantGrace(USER.id);
    expect(redis.setSingleUse).toHaveBeenCalledWith(`coopid:login2fa:grace:${USER.id}`, '1', 300);
  });
});
