import { UnauthorizedException } from '@nestjs/common';
import { AuthInteractor } from './auth.interactor';

/**
 * Гейты легаси-входа по подписи: мигрировавший пайщик (vault-блоб существует)
 * и пайщик с включённым 2FA входят только новым контуром — иначе ключ обходил
 * бы и пароль, и коды подтверждения.
 */
describe('AuthInteractor.login', () => {
  const user = { id: 'uid-1', username: 'ant' };

  function deps(opts: { hasVault?: boolean; has2fa?: boolean } = {}) {
    const accountDomainService = { getAccount: jest.fn().mockResolvedValue({ username: 'ant' }) };
    const notificationSenderService = {};
    const authDomainService = { loginUserWithSignature: jest.fn().mockResolvedValue(user) };
    const tokenApplicationService = { generateAuthTokens: jest.fn().mockResolvedValue({ access: {}, refresh: {} }) };
    const blockchainPort = {};
    const userDomainService = {};
    const loginTwoFactor = { hasEnabledFactorSettings: jest.fn().mockResolvedValue(!!opts.has2fa) };
    const vault = { retrieve: jest.fn().mockResolvedValue(opts.hasVault ? { ciphertext: 'x' } : null) };
    const interactor = new AuthInteractor(
      accountDomainService as any,
      notificationSenderService as any,
      authDomainService as any,
      tokenApplicationService as any,
      blockchainPort as any,
      userDomainService as any,
      loginTwoFactor as any,
      vault as any,
    );
    return { interactor, tokenApplicationService, vault, loginTwoFactor };
  }

  const input = { email: 'a@e.com', now: '2026-06-14T12:00:00.000Z', signature: 'SIG_K1_x' } as any;

  it('не мигрировал и без 2FA — вход по подписи работает (SDK-интеграции не задеты)', async () => {
    const { interactor, tokenApplicationService, vault } = deps();
    const result = await interactor.login(input);
    expect(vault.retrieve).toHaveBeenCalledWith({ subject_type: 'participant', subject_id: 'ant' });
    expect(tokenApplicationService.generateAuthTokens).toHaveBeenCalledWith('uid-1');
    expect(result.tokens).toBeDefined();
  });

  it('пароль установлен (vault существует) → отказ, токены не выпускаются', async () => {
    const { interactor, tokenApplicationService } = deps({ hasVault: true });
    await expect(interactor.login(input)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenApplicationService.generateAuthTokens).not.toHaveBeenCalled();
  });

  it('включён фактор 2FA → отказ, токены не выпускаются', async () => {
    const { interactor, tokenApplicationService } = deps({ has2fa: true });
    await expect(interactor.login(input)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenApplicationService.generateAuthTokens).not.toHaveBeenCalled();
  });
});
