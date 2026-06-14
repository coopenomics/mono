import { createHash } from 'crypto';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { canonicalMigrationMessage, MigrationService } from './migration.service';

/** Story 11.4 — миграция «ключ→пароль»: верификация подписи против COOPOS + set_password. */
describe('MigrationService', () => {
  const TS = '2026-06-14T12:00:00.000Z';
  const KEY = 'PUB_K1_active';
  const SIG = 'SIG_K1_whatever';

  function deps() {
    const blockchainPort = {
      getInfo: jest.fn().mockResolvedValue({ head_block_time: TS }),
      getAccount: jest.fn().mockResolvedValue({ permissions: [] }),
      recoverPublicKey: jest.fn().mockReturnValue(KEY),
      hasActiveKey: jest.fn().mockReturnValue(true),
    };
    const userDomainService = { getUserByEmail: jest.fn().mockResolvedValue({ username: 'ant' }) };
    const authentikAdmin = { ensureUser: jest.fn().mockResolvedValue(42), setPassword: jest.fn().mockResolvedValue(undefined) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new MigrationService(blockchainPort as any, userDomainService as any, authentikAdmin as any, audit as any);
    return { service, blockchainPort, userDomainService, authentikAdmin };
  }

  const input = { email: 'a@e.com', timestamp: TS, signature: SIG, newPassword: 'Strong#Pass1' };

  it('happy path: верифицирует подпись и ставит пароль; сообщение биндит ts + sha256(пароль)', async () => {
    const { service, blockchainPort, authentikAdmin } = deps();
    await service.migrate({ ...input });

    const pwHash = createHash('sha256').update('Strong#Pass1', 'utf8').digest('hex');
    expect(blockchainPort.recoverPublicKey).toHaveBeenCalledWith(canonicalMigrationMessage({ ts: TS, pw_hash: pwHash }), SIG);
    expect(blockchainPort.hasActiveKey).toHaveBeenCalledWith(expect.anything(), KEY);
    expect(authentikAdmin.ensureUser).toHaveBeenCalledWith({ username: 'ant', email: 'a@e.com', name: 'ant' });
    expect(authentikAdmin.setPassword).toHaveBeenCalledWith(42, 'Strong#Pass1');
  });

  it('короткий пароль → WeakPassword, без обращения к цепи', async () => {
    const { service, blockchainPort } = deps();
    await expect(service.migrate({ ...input, newPassword: 'short' })).rejects.toMatchObject({ code: AuthV2ErrorCode.WeakPassword });
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
