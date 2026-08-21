import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import { RecoveryStrategyService } from './recovery-strategy.service';

function setup() {
  const repo = { get: jest.fn(), set: jest.fn().mockResolvedValue(undefined) };
  const twoFactor = { isEnabled: jest.fn(), verify: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const securityEvents = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new RecoveryStrategyService(repo as never, twoFactor as never, audit as never, securityEvents as never);
  return { service, repo, twoFactor, audit, securityEvents };
}

describe('RecoveryStrategyService (Story 3.5)', () => {
  it('getStrategy: нет записи → дефолт email_magic_link', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValueOnce(null);
    expect(await service.getStrategy('u1')).toBe(RecoveryStrategy.EmailMagicLink);
  });

  it('getStrategy: возвращает сохранённую стратегию', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValueOnce(RecoveryStrategy.OfflineCode);
    expect(await service.getStrategy('u1')).toBe(RecoveryStrategy.OfflineCode);
  });

  it('setStrategy: 2FA + верный код → set + audit strategy_changed + security-уведомление (3.11)', async () => {
    const { service, repo, twoFactor, audit, securityEvents } = setup();
    twoFactor.isEnabled.mockResolvedValueOnce(true);
    twoFactor.verify.mockResolvedValueOnce(true);
    await service.setStrategy('u1', RecoveryStrategy.OfflineCode, '123456', '1.2.3.4');
    expect(twoFactor.verify).toHaveBeenCalledWith('u1', '123456');
    expect(repo.set).toHaveBeenCalledWith('u1', RecoveryStrategy.OfflineCode);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coopid.recovery.strategy_changed',
        result: 'success',
        context: { strategy: RecoveryStrategy.OfflineCode },
      }),
    );
    expect(securityEvents.notify).toHaveBeenCalledWith({ subjectId: 'u1', kind: 'recovery_strategy_changed', ip: '1.2.3.4' });
  });

  it('setStrategy: нет 2FA → TwoFactorNotEnrolled, без set', async () => {
    const { service, repo, twoFactor } = setup();
    twoFactor.isEnabled.mockResolvedValueOnce(false);
    await expect(service.setStrategy('u1', RecoveryStrategy.Council, '123456', null)).rejects.toMatchObject({
      code: AuthV2ErrorCode.TwoFactorNotEnrolled,
    });
    expect(repo.set).not.toHaveBeenCalled();
  });

  it('setStrategy: неверный код → InvalidTwoFactorCode, без set', async () => {
    const { service, repo, twoFactor } = setup();
    twoFactor.isEnabled.mockResolvedValueOnce(true);
    twoFactor.verify.mockResolvedValueOnce(false);
    await expect(service.setStrategy('u1', RecoveryStrategy.Council, '000000', null)).rejects.toMatchObject({
      code: AuthV2ErrorCode.InvalidTwoFactorCode,
    });
    expect(repo.set).not.toHaveBeenCalled();
  });

  it('isChannelActive: сверяет канал с текущей стратегией', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValue(RecoveryStrategy.OfflineCode);
    expect(await service.isChannelActive('u1', RecoveryStrategy.OfflineCode)).toBe(true);
    expect(await service.isChannelActive('u1', RecoveryStrategy.EmailMagicLink)).toBe(false);
  });

  it('isChannelActive: дефолт (нет записи) → активен только email', async () => {
    const { service, repo } = setup();
    repo.get.mockResolvedValue(null);
    expect(await service.isChannelActive('u1', RecoveryStrategy.EmailMagicLink)).toBe(true);
    expect(await service.isChannelActive('u1', RecoveryStrategy.OfflineCode)).toBe(false);
  });
});
