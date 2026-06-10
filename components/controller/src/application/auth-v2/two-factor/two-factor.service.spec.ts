jest.mock('~/config/config', () => ({ __esModule: true, default: { coopname: 'voskhod' } }));
jest.mock('~/utils/aes', () => ({
  encrypt: (s: string) => `enc(${s})`,
  decrypt: (s: string) => s.replace(/^enc\((.*)\)$/, '$1'),
}));
jest.mock('~/domain/auth-v2/totp/totp', () => ({
  generateTotpSecret: () => 'SECRET32',
  buildOtpauthUri: () => 'otpauth://totp/voskhod:ant?secret=SECRET32',
  verifyTotp: jest.fn(),
}));

import { verifyTotp } from '~/domain/auth-v2/totp/totp';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { TwoFactorService } from './two-factor.service';

const verifyMock = verifyTotp as jest.Mock;

describe('TwoFactorService (Story 3.6 — TOTP)', () => {
  function setup() {
    const repo = {
      get: jest.fn(),
      putPending: jest.fn().mockResolvedValue(undefined),
      enable: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const securityEvents = { notify: jest.fn().mockResolvedValue(undefined) };
    const service = new TwoFactorService(repo as never, audit as never, securityEvents as never);
    return { service, repo, audit, securityEvents };
  }

  beforeEach(() => verifyMock.mockReset());

  it('beginEnrollment: кладёт зашифрованный секрет (pending) и отдаёт challenge', async () => {
    const { service, repo } = setup();
    const challenge = await service.beginEnrollment('u1', 'ant');
    expect(repo.putPending).toHaveBeenCalledWith('u1', 'enc(SECRET32)');
    expect(challenge.secret).toBe('SECRET32');
    expect(challenge.otpauthUri).toContain('otpauth://totp/');
  });

  it('activate: верный код → enable + audit coopid.2fa.enabled + security-уведомление (3.11)', async () => {
    const { service, repo, audit, securityEvents } = setup();
    repo.get.mockResolvedValueOnce({ subjectId: 'u1', secretEnc: 'enc(SECRET32)', enabled: false });
    verifyMock.mockReturnValueOnce(true);
    await service.activate('u1', '123456', '1.2.3.4');
    expect(verifyMock).toHaveBeenCalledWith('SECRET32', '123456');
    expect(repo.enable).toHaveBeenCalledWith('u1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'coopid.2fa.enabled', result: 'success' }));
    expect(securityEvents.notify).toHaveBeenCalledWith({ subjectId: 'u1', kind: 'two_factor_enabled', ip: '1.2.3.4' });
  });

  it('activate: неверный код → InvalidTwoFactorCode, без enable', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValueOnce({ subjectId: 'u1', secretEnc: 'enc(SECRET32)', enabled: false });
    verifyMock.mockReturnValueOnce(false);
    await expect(service.activate('u1', '000000', null)).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidTwoFactorCode });
    expect(repo.enable).not.toHaveBeenCalled();
  });

  it('activate: секрет не выпущен → TwoFactorNotEnrolled', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValueOnce(null);
    await expect(service.activate('u1', '123456', null)).rejects.toMatchObject({ code: AuthV2ErrorCode.TwoFactorNotEnrolled });
  });

  it('disable: требует enabled + валидный код → remove + audit + security-уведомление (3.11)', async () => {
    const { service, repo, audit, securityEvents } = setup();
    repo.get.mockResolvedValueOnce({ subjectId: 'u1', secretEnc: 'enc(SECRET32)', enabled: true });
    verifyMock.mockReturnValueOnce(true);
    await service.disable('u1', '123456', null);
    expect(repo.remove).toHaveBeenCalledWith('u1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'coopid.2fa.disabled' }));
    expect(securityEvents.notify).toHaveBeenCalledWith({ subjectId: 'u1', kind: 'two_factor_disabled', ip: null });
  });

  it('disable: не подключён → TwoFactorNotEnrolled', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValueOnce({ subjectId: 'u1', secretEnc: 'enc(SECRET32)', enabled: false });
    await expect(service.disable('u1', '123456', null)).rejects.toMatchObject({ code: AuthV2ErrorCode.TwoFactorNotEnrolled });
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('verify (порт для recovery): enabled + верный код → true', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValue({ subjectId: 'u1', secretEnc: 'enc(SECRET32)', enabled: true });
    verifyMock.mockReturnValueOnce(true);
    expect(await service.verify('u1', '123456')).toBe(true);
  });

  it('verify: 2FA не подключён → false (без проверки кода)', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValueOnce(null);
    expect(await service.verify('u1', '123456')).toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('isEnabled отражает состояние записи', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValueOnce({ subjectId: 'u1', secretEnc: 'x', enabled: true });
    expect(await service.isEnabled('u1')).toBe(true);
    repo.get.mockResolvedValueOnce(null);
    expect(await service.isEnabled('u1')).toBe(false);
  });
});
