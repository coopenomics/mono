import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { SecurityEventKind } from '~/domain/auth-v2/security-events/security-event.types';
import { LoginFactorsService } from './login-factors.service';

const SUBJECT = 'user-uuid-1';

function setup(overrides: {
  record?: { totpEnabled: boolean; emailEnabled: boolean } | null;
  enrolled?: boolean;
  codeValid?: boolean;
  emailVerified?: boolean;
} = {}) {
  const repo = {
    get: jest.fn().mockResolvedValue(
      overrides.record === undefined
        ? null
        : overrides.record
        ? { subjectId: SUBJECT, ...overrides.record }
        : null,
    ),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const twoFactor = {
    isEnabled: jest.fn().mockResolvedValue(overrides.enrolled ?? true),
    verify: jest.fn().mockResolvedValue(overrides.codeValid ?? true),
  };
  const users = {
    findUserById: jest.fn().mockResolvedValue({
      id: SUBJECT,
      username: 'ant',
      is_email_verified: overrides.emailVerified ?? true,
    }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const securityEvents = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new LoginFactorsService(
    repo as any,
    twoFactor as any,
    users as any,
    audit as any,
    securityEvents as any,
  );
  return { service, repo, twoFactor, users, audit, securityEvents };
}

describe('LoginFactorsService (настройки 2FA-входа)', () => {
  it('get: без записи — всё выключено, доступность из enrollment и почты', async () => {
    const { service } = setup({ record: null, enrolled: true, emailVerified: false });
    await expect(service.get(SUBJECT)).resolves.toEqual({
      totp_enrolled: true,
      totp_enabled: false,
      email_available: false,
      email_enabled: false,
    });
  });

  it('set: включение TOTP-фактора без кода → InvalidTwoFactorCode', async () => {
    const { service, repo } = setup();
    await expect(
      service.set(SUBJECT, { totp_enabled: true, email_enabled: false }, null),
    ).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidTwoFactorCode });
    expect(repo.set).not.toHaveBeenCalled();
  });

  it('set: включение TOTP-фактора без подключённого приложения → TwoFactorNotEnrolled', async () => {
    const { service } = setup({ enrolled: false });
    await expect(
      service.set(SUBJECT, { totp_enabled: true, email_enabled: false, code: '123456' }, null),
    ).rejects.toMatchObject({ code: AuthV2ErrorCode.TwoFactorNotEnrolled });
  });

  it('set: ОТКЛЮЧЕНИЕ TOTP-фактора тоже требует код (угнанная сессия не снимает защиту)', async () => {
    const { service, repo } = setup({ record: { totpEnabled: true, emailEnabled: false } });
    await expect(
      service.set(SUBJECT, { totp_enabled: false, email_enabled: false }, null),
    ).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidTwoFactorCode });
    expect(repo.set).not.toHaveBeenCalled();
  });

  it('set: email-фактор при неподтверждённой почте → InvalidCredentials', async () => {
    const { service } = setup({ emailVerified: false });
    await expect(
      service.set(SUBJECT, { totp_enabled: false, email_enabled: true }, null),
    ).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidCredentials });
  });

  it('set: успех пишет запись, аудит и security-уведомление', async () => {
    const { service, repo, audit, securityEvents } = setup();
    const view = await service.set(SUBJECT, { totp_enabled: false, email_enabled: true }, '1.2.3.4');
    expect(repo.set).toHaveBeenCalledWith({ subjectId: SUBJECT, totpEnabled: false, emailEnabled: true });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.login_factors.changed', subjectId: SUBJECT }),
    );
    expect(securityEvents.notify).toHaveBeenCalledWith(
      expect.objectContaining({ kind: SecurityEventKind.LoginFactorsChanged }),
    );
    expect(view).toMatchObject({ email_available: true });
  });

  it('set: без фактических изменений — ни аудита, ни уведомления', async () => {
    const { service, audit, securityEvents } = setup({ record: { totpEnabled: false, emailEnabled: true } });
    await service.set(SUBJECT, { totp_enabled: false, email_enabled: true }, null);
    expect(audit.record).not.toHaveBeenCalled();
    expect(securityEvents.notify).not.toHaveBeenCalled();
  });

  it('set: изменение TOTP с верным кодом проходит', async () => {
    const { service, repo, twoFactor } = setup({ record: { totpEnabled: false, emailEnabled: false } });
    await service.set(SUBJECT, { totp_enabled: true, email_enabled: false, code: '123456' }, null);
    expect(twoFactor.verify).toHaveBeenCalledWith(SUBJECT, '123456');
    expect(repo.set).toHaveBeenCalledWith({ subjectId: SUBJECT, totpEnabled: true, emailEnabled: false });
  });

  it('onTotpUnenrolled: гасит включённый TOTP-фактор, email не трогает', async () => {
    const { service, repo } = setup({ record: { totpEnabled: true, emailEnabled: true } });
    await service.onTotpUnenrolled(SUBJECT);
    expect(repo.set).toHaveBeenCalledWith({ subjectId: SUBJECT, totpEnabled: false, emailEnabled: true });
  });

  it('onTotpUnenrolled: без включённого фактора ничего не пишет', async () => {
    const { service, repo } = setup({ record: { totpEnabled: false, emailEnabled: true } });
    await service.onTotpUnenrolled(SUBJECT);
    expect(repo.set).not.toHaveBeenCalled();
  });
});
