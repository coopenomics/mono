import { createHash } from 'crypto';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { canonicalMigrationMessage, MigrationService } from './migration.service';

/**
 * Story 11.4 — миграция «ключ→пароль»: верификация подписи против COOPOS +
 * set_password; с ротацией — vault → changekey → отзыв сессий; кандидат — сверка
 * с public_key учётки, ротация недоступна.
 */
describe('MigrationService', () => {
  const TS = '2026-06-14T12:00:00.000Z';
  const KEY = 'PUB_K1_active';
  const NEW_KEY = 'PUB_K1_fresh';
  const SIG = 'SIG_K1_whatever';
  const BLOB = { cipher_version: 'aes-256-gcm-v1', kdf_version: 'argon2id-v1', salt: 's', nonce: 'n', ciphertext: 'c', auth_tag: 't' } as any;

  function deps(user: Record<string, unknown> = { id: 'uid-1', username: 'ant', is_registered: true, public_key: '' }) {
    const blockchainPort = {
      getInfo: jest.fn().mockResolvedValue({ head_block_time: TS }),
      getAccount: jest.fn().mockResolvedValue({ permissions: [] }),
      recoverPublicKey: jest.fn().mockReturnValue(KEY),
      hasActiveKey: jest.fn().mockReturnValue(true),
      changeKey: jest.fn().mockResolvedValue(undefined),
    };
    const userDomainService = { getUserByEmail: jest.fn().mockResolvedValue(user) };
    const authentikAdmin = { ensureUser: jest.fn().mockResolvedValue(42), setPassword: jest.fn().mockResolvedValue(undefined) };
    const vault = { store: jest.fn().mockResolvedValue(undefined) };
    const sessions = { revokeAll: jest.fn().mockResolvedValue({ revoked: 2 }) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new MigrationService(
      blockchainPort as any,
      userDomainService as any,
      authentikAdmin as any,
      vault as any,
      sessions as any,
      audit as any,
    );
    return { service, blockchainPort, userDomainService, authentikAdmin, vault, sessions };
  }

  const input = { email: 'a@e.com', timestamp: TS, signature: SIG, newPassword: 'Strong#Pass1' };

  it('happy path без ротации: верифицирует подпись и ставит пароль; сообщение биндит ts + sha256(пароль)', async () => {
    const { service, blockchainPort, authentikAdmin, vault } = deps();
    const result = await service.migrate({ ...input });

    const pwHash = createHash('sha256').update('Strong#Pass1', 'utf8').digest('hex');
    expect(blockchainPort.recoverPublicKey).toHaveBeenCalledWith(canonicalMigrationMessage({ ts: TS, pw_hash: pwHash }), SIG);
    expect(blockchainPort.hasActiveKey).toHaveBeenCalledWith(expect.anything(), KEY);
    expect(authentikAdmin.ensureUser).toHaveBeenCalledWith({ username: 'ant', email: 'a@e.com', name: 'ant' });
    expect(authentikAdmin.setPassword).toHaveBeenCalledWith(42, 'Strong#Pass1');
    expect(blockchainPort.changeKey).not.toHaveBeenCalled();
    expect(vault.store).not.toHaveBeenCalled();
    expect(result).toEqual({ username: 'ant', rotated: false });
  });

  it('ротация: сообщение биндит pk; порядок vault → changekey → revokeAll', async () => {
    const { service, blockchainPort, vault, sessions } = deps();
    const calls: string[] = [];
    vault.store.mockImplementation(async () => { calls.push('vault'); });
    blockchainPort.changeKey.mockImplementation(async () => { calls.push('changekey'); });
    sessions.revokeAll.mockImplementation(async () => { calls.push('revoke'); return { revoked: 2 }; });

    const result = await service.migrate({ ...input, newPublicKey: NEW_KEY, vaultBlob: BLOB });

    const pwHash = createHash('sha256').update('Strong#Pass1', 'utf8').digest('hex');
    expect(blockchainPort.recoverPublicKey).toHaveBeenCalledWith(
      canonicalMigrationMessage({ ts: TS, pw_hash: pwHash, pk: NEW_KEY }),
      SIG,
    );
    expect(vault.store).toHaveBeenCalledWith({ subject_type: 'participant', subject_id: 'ant' }, BLOB);
    expect(blockchainPort.changeKey).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'ant', public_key: NEW_KEY }),
    );
    expect(sessions.revokeAll).toHaveBeenCalledWith('uid-1', null);
    expect(calls).toEqual(['vault', 'changekey', 'revoke']);
    expect(result).toEqual({ username: 'ant', rotated: true });
  });

  it('ротация без vault-блоба отвергается до любых записей', async () => {
    const { service, authentikAdmin } = deps();
    await expect(service.migrate({ ...input, newPublicKey: NEW_KEY })).rejects.toMatchObject({
      code: AuthV2ErrorCode.ChainVerificationFailed,
    });
    expect(authentikAdmin.setPassword).not.toHaveBeenCalled();
  });

  it('кандидат: сверка с public_key учётки (аккаунта в цепи нет), без ротации', async () => {
    const { service, blockchainPort, authentikAdmin } = deps({ id: 'uid-2', username: 'newbie', is_registered: false, public_key: KEY });
    const result = await service.migrate({ ...input });
    expect(blockchainPort.getAccount).not.toHaveBeenCalled();
    // сверка через псевдо-аккаунт с единственным ключом учётки
    expect(blockchainPort.hasActiveKey).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: [expect.objectContaining({ perm_name: 'active' })] }),
      KEY,
    );
    expect(authentikAdmin.setPassword).toHaveBeenCalledWith(42, 'Strong#Pass1');
    expect(result).toEqual({ username: 'newbie', rotated: false });
  });

  it('кандидат, запросивший ротацию → RotationUnavailable (клиент повторит без неё)', async () => {
    const { service, authentikAdmin } = deps({ id: 'uid-2', username: 'newbie', is_registered: false, public_key: KEY });
    await expect(service.migrate({ ...input, newPublicKey: NEW_KEY, vaultBlob: BLOB })).rejects.toMatchObject({
      code: AuthV2ErrorCode.RotationUnavailable,
    });
    expect(authentikAdmin.setPassword).not.toHaveBeenCalled();
  });

  it('пароль против политики (без цифры/спецсимвола) → WeakPassword, без обращения к цепи', async () => {
    const { service, blockchainPort } = deps();
    for (const bad of ['short1!', 'безцифрспец!', 'NoSpecial123']) {
      await expect(service.migrate({ ...input, newPassword: bad })).rejects.toMatchObject({ code: AuthV2ErrorCode.WeakPassword });
    }
    expect(blockchainPort.getInfo).not.toHaveBeenCalled();
  });

  it('email не найден → InvalidCredentials (без enumeration)', async () => {
    const { service, userDomainService, authentikAdmin } = deps();
    userDomainService.getUserByEmail.mockRejectedValue(new Error('not found'));
    await expect(service.migrate({ ...input })).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidCredentials });
    expect(authentikAdmin.setPassword).not.toHaveBeenCalled();
  });

  it('протухшая метка времени → TimestampTooOld', async () => {
    const { service, blockchainPort } = deps();
    blockchainPort.getInfo.mockResolvedValue({ head_block_time: '2026-06-14T12:05:00.000Z' }); // +300s
    await expect(service.migrate({ ...input })).rejects.toMatchObject({ code: AuthV2ErrorCode.TimestampTooOld });
  });

  it('ключ не совпадает с он-чейн active → InvalidCredentials, пароль не ставим', async () => {
    const { service, blockchainPort, authentikAdmin } = deps();
    blockchainPort.hasActiveKey.mockReturnValue(false);
    await expect(service.migrate({ ...input })).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidCredentials });
    expect(authentikAdmin.ensureUser).not.toHaveBeenCalled();
  });

  it('COOPOS недоступен (getInfo бросает) → CooposDegraded', async () => {
    const { service, blockchainPort } = deps();
    blockchainPort.getInfo.mockRejectedValue(new Error('rpc down'));
    await expect(service.migrate({ ...input })).rejects.toMatchObject({ code: AuthV2ErrorCode.CooposDegraded });
  });

  it('битая подпись (recoverPublicKey бросает) → InvalidCredentials', async () => {
    const { service, blockchainPort } = deps();
    blockchainPort.recoverPublicKey.mockImplementation(() => { throw new Error('bad sig'); });
    await expect(service.migrate({ ...input })).rejects.toMatchObject({ code: AuthV2ErrorCode.InvalidCredentials });
  });
});
