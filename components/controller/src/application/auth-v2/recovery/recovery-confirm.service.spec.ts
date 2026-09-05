import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { RecoveryConfirmService } from './recovery-confirm.service';

const PAYLOAD = { subjectId: 'u1', username: 'ant', coopname: 'voskhod' };
const VAULT = {
  cipher_version: 'v1',
  kdf_version: 'v1',
  salt: 's',
  nonce: 'n',
  ciphertext: 'c',
  auth_tag: 't',
};
// Пароль обязан проходить парольную политику CoopID (8+ символов, цифра,
// спецсимвол) — иначе confirm отсекает вход раньше проверок токена и 2FA,
// и сценарии ниже проверяли бы не то, ради чего написаны.
const NEW_PASSWORD = 'Pa55word!';
const INPUT = { token: 'tok-1', code: '123456', newPublicKey: 'EOS_NEW', vaultBlob: VAULT, newPassword: NEW_PASSWORD };

function setup() {
  const tokenStore = {
    issue: jest.fn(),
    peek: jest.fn(),
    consume: jest.fn(),
  };
  const twoFactor = { isEnabled: jest.fn(), verify: jest.fn() };
  const finalization = { finalize: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new RecoveryConfirmService(
    tokenStore as never,
    twoFactor as never,
    finalization as never,
    audit as never,
  );
  return { service, tokenStore, twoFactor, finalization, audit };
}

describe('RecoveryConfirmService (Story 3.2 — двухканальное подтверждение)', () => {
  it('confirm: валидный токен + 2FA + верный код → consume + finalize + audit success', async () => {
    const { service, tokenStore, twoFactor, finalization, audit } = setup();
    tokenStore.peek.mockResolvedValueOnce(PAYLOAD);
    twoFactor.isEnabled.mockResolvedValueOnce(true);
    twoFactor.verify.mockResolvedValueOnce(true);
    tokenStore.consume.mockResolvedValueOnce(PAYLOAD);

    const result = await service.confirm(INPUT, '1.2.3.4');

    expect(result).toEqual({ username: 'ant' });
    expect(twoFactor.verify).toHaveBeenCalledWith('u1', '123456');
    expect(tokenStore.consume).toHaveBeenCalledWith('tok-1');
    expect(finalization.finalize).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'u1', username: 'ant', coopname: 'voskhod', newPublicKey: 'EOS_NEW', vaultBlob: VAULT, newPassword: NEW_PASSWORD }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.recovery.confirmed', result: 'success' }),
    );
  });

  it('confirm: audit-контекст без секретов (нет пароля/ключа/кода/токена)', async () => {
    const { service, tokenStore, twoFactor, audit } = setup();
    tokenStore.peek.mockResolvedValueOnce(PAYLOAD);
    twoFactor.isEnabled.mockResolvedValueOnce(true);
    twoFactor.verify.mockResolvedValueOnce(true);
    tokenStore.consume.mockResolvedValueOnce(PAYLOAD);

    await service.confirm(INPUT, null);

    const ctx = audit.record.mock.calls[0][0].context as Record<string, unknown>;
    expect(ctx).toEqual({ strategy: 'email_magic_link', second_factor: 'totp' });
  });

  it('confirm: токен недействителен (peek null) → InvalidRecoveryToken, без finalize/consume', async () => {
    const { service, tokenStore, finalization } = setup();
    tokenStore.peek.mockResolvedValueOnce(null);
    await expect(service.confirm(INPUT, null)).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidRecoveryToken });
    expect(tokenStore.consume).not.toHaveBeenCalled();
    expect(finalization.finalize).not.toHaveBeenCalled();
  });

  it('confirm: 2FA не подключён → код не спрашивается, восстановление проходит', async () => {
    // Решение владельца 03.09.2026: TOTP требуется только тем, кто его подключал.
    // Раньше здесь летел TwoFactorNotEnrolled, и у большинства пайщиков восстановление
    // было мертво — экран просил код, которого у них нет и быть не может.
    const { service, tokenStore, twoFactor, finalization, audit } = setup();
    tokenStore.peek.mockResolvedValueOnce(PAYLOAD);
    tokenStore.consume.mockResolvedValueOnce(PAYLOAD);
    twoFactor.isEnabled.mockResolvedValueOnce(false);

    await expect(service.confirm({ ...INPUT, code: undefined }, null)).resolves.toEqual({
      username: PAYLOAD.username,
    });

    // Код не проверяем вовсе — проверять нечего.
    expect(twoFactor.verify).not.toHaveBeenCalled();
    expect(finalization.finalize).toHaveBeenCalledTimes(1);
    // В журнале видно, чем подтвердили: только ссылкой из почты.
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coopid.recovery.confirmed',
        result: 'success',
        context: expect.objectContaining({ second_factor: 'none' }),
      }),
    );
  });

  it('confirm: 2FA подключён → код по-прежнему обязателен (контур двух каналов цел)', async () => {
    const { service, tokenStore, twoFactor, finalization } = setup();
    tokenStore.peek.mockResolvedValueOnce(PAYLOAD);
    twoFactor.isEnabled.mockResolvedValueOnce(true);
    twoFactor.verify.mockResolvedValueOnce(false);

    await expect(service.confirm({ ...INPUT, code: undefined }, null)).rejects.toMatchObject({
      code: AuthV2ErrorCode.InvalidTwoFactorCode,
    });
    expect(tokenStore.consume).not.toHaveBeenCalled();
    expect(finalization.finalize).not.toHaveBeenCalled();
  });

  it('confirm: неверный TOTP → InvalidTwoFactorCode, magic-link НЕ сжигается (без consume)', async () => {
    const { service, tokenStore, twoFactor, finalization } = setup();
    tokenStore.peek.mockResolvedValueOnce(PAYLOAD);
    twoFactor.isEnabled.mockResolvedValueOnce(true);
    twoFactor.verify.mockResolvedValueOnce(false);
    await expect(service.confirm(INPUT, null)).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidTwoFactorCode });
    expect(tokenStore.consume).not.toHaveBeenCalled();
    expect(finalization.finalize).not.toHaveBeenCalled();
  });

  it('confirm: гонка — peek ок, но consume вернул null → InvalidRecoveryToken, без finalize', async () => {
    const { service, tokenStore, twoFactor, finalization } = setup();
    tokenStore.peek.mockResolvedValueOnce(PAYLOAD);
    twoFactor.isEnabled.mockResolvedValueOnce(true);
    twoFactor.verify.mockResolvedValueOnce(true);
    tokenStore.consume.mockResolvedValueOnce(null);
    await expect(service.confirm(INPUT, null)).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidRecoveryToken });
    expect(finalization.finalize).not.toHaveBeenCalled();
  });

  it('confirm: финализация упала → audit failure + проброс ошибки', async () => {
    const { service, tokenStore, twoFactor, finalization, audit } = setup();
    tokenStore.peek.mockResolvedValueOnce(PAYLOAD);
    twoFactor.isEnabled.mockResolvedValueOnce(true);
    twoFactor.verify.mockResolvedValueOnce(true);
    tokenStore.consume.mockResolvedValueOnce(PAYLOAD);
    finalization.finalize.mockRejectedValueOnce(new Error('coopos down'));
    await expect(service.confirm(INPUT, null)).rejects.toThrow('coopos down');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.recovery.confirmed', result: 'failure' }),
    );
  });

  it('cancel: валидный токен → consume + audit cancelled', async () => {
    const { service, tokenStore, audit } = setup();
    tokenStore.consume.mockResolvedValueOnce(PAYLOAD);
    await service.cancel('tok-1', '1.2.3.4');
    expect(tokenStore.consume).toHaveBeenCalledWith('tok-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.recovery.cancelled', subjectId: 'u1', result: 'success' }),
    );
  });

  it('cancel: токена нет → InvalidRecoveryToken', async () => {
    const { service, tokenStore } = setup();
    tokenStore.consume.mockResolvedValueOnce(null);
    await expect(service.cancel('gone', null)).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidRecoveryToken });
  });
});
