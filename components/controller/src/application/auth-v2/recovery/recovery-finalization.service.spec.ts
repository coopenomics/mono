import { SecurityEventKind } from '~/domain/auth-v2/security-events/security-event.types';
import type { RecoveryFinalizationInput } from '~/domain/auth-v2/ports/recovery-finalization.port';
import { RecoveryFinalizationService } from './recovery-finalization.service';

const VAULT = {
  cipher_version: 'v1',
  kdf_version: 'v1',
  salt: 's',
  nonce: 'n',
  ciphertext: 'c',
} as RecoveryFinalizationInput['vaultBlob'];

const INPUT: RecoveryFinalizationInput = {
  subjectId: 'u1',
  username: 'ant',
  coopname: 'voskhod',
  newPublicKey: 'PUB_K1_NEW',
  vaultBlob: VAULT,
  newPassword: 'pw',
  ip: '1.2.3.4',
};

function account(activeKey: string | null) {
  return {
    permissions: [
      {
        perm_name: 'active',
        required_auth: { keys: activeKey ? [{ key: activeKey, weight: 1 }] : [] },
      },
    ],
  };
}

function setup() {
  const chain = {
    getAccount: jest.fn().mockResolvedValue(account('PUB_K1_OLD')),
    changeKey: jest.fn().mockResolvedValue(undefined),
  };
  const authentikAdmin = {
    findUserPk: jest.fn().mockResolvedValue(42),
    ensureUser: jest.fn().mockResolvedValue(77),
    setPassword: jest.fn().mockResolvedValue(undefined),
  };
  const users = { getUserByUsername: jest.fn().mockResolvedValue({ username: 'ant', email: 'ant@coop.test' }) };
  const vault = { store: jest.fn().mockResolvedValue(undefined) };
  const sessions = { revokeAll: jest.fn().mockResolvedValue({ revoked: 3 }) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const securityEvents = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new RecoveryFinalizationService(
    chain as never,
    authentikAdmin as never,
    users as never,
    vault as never,
    sessions as never,
    audit as never,
    securityEvents as never,
  );
  return { service, chain, authentikAdmin, users, vault, sessions, audit, securityEvents };
}

describe('RecoveryFinalizationService (Story 3.3)', () => {
  it('финализация: setPassword authentik → vault.store → registrator changekey → revokeAll → audit KeyRotated → notify', async () => {
    const { service, chain, authentikAdmin, vault, sessions, audit, securityEvents } = setup();

    await service.finalize(INPUT);

    // Story 12.1: пароль пишется в authentik (раньше молча игнорировался → залок входа).
    expect(authentikAdmin.findUserPk).toHaveBeenCalledWith('ant');
    expect(authentikAdmin.setPassword).toHaveBeenCalledWith(42, 'pw');
    expect(vault.store).toHaveBeenCalledWith(
      { subject_type: 'participant', subject_id: 'ant' },
      VAULT,
    );
    expect(chain.changeKey).toHaveBeenCalledWith({
      coopname: 'voskhod',
      changer: 'voskhod',
      username: 'ant',
      public_key: 'PUB_K1_NEW',
    });
    expect(sessions.revokeAll).toHaveBeenCalledWith('u1', '1.2.3.4');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'KeyRotated',
        subjectId: 'u1',
        actor: 'self',
        result: 'success',
        ip: '1.2.3.4',
        context: {
          trigger: 'recovery',
          old_pubkey: 'PUB_K1_OLD',
          new_pubkey: 'PUB_K1_NEW',
          initiator_id: 'u1',
          sessions_revoked: 3,
        },
      }),
    );
    expect(securityEvents.notify).toHaveBeenCalledWith({
      subjectId: 'u1',
      kind: SecurityEventKind.KeyRotated,
      ip: '1.2.3.4',
    });
  });

  it('инвариант порядка: setPassword (внешний IdP) ДО vault.store ДО on-chain changekey', async () => {
    const { service, chain, authentikAdmin, vault } = setup();
    await service.finalize(INPUT);
    // authentik первым: его сбой не трогает vault/цепь → откат на старые креды (Story 12.1).
    expect(authentikAdmin.setPassword.mock.invocationCallOrder[0]).toBeLessThan(
      vault.store.mock.invocationCallOrder[0],
    );
    // vault ДО changekey: новый приватный ключ живёт только в блобе (Story 3.3).
    expect(vault.store.mock.invocationCallOrder[0]).toBeLessThan(
      chain.changeKey.mock.invocationCallOrder[0],
    );
  });

  it('нет учётки authentik (легаси-пайщик без пароля) → ensureUser по email и штатная финализация', async () => {
    const { service, chain, authentikAdmin, users, vault } = setup();
    authentikAdmin.findUserPk.mockResolvedValueOnce(null);

    await service.finalize(INPUT);

    expect(users.getUserByUsername).toHaveBeenCalledWith('ant');
    expect(authentikAdmin.ensureUser).toHaveBeenCalledWith({ username: 'ant', email: 'ant@coop.test', name: 'ant' });
    expect(authentikAdmin.setPassword).toHaveBeenCalledWith(77, 'pw');
    expect(vault.store).toHaveBeenCalled();
    expect(chain.changeKey).toHaveBeenCalled();
  });

  it('сбой setPassword (IdP недоступен) → vault и changekey не трогаются (откат на старые креды)', async () => {
    const { service, chain, authentikAdmin, vault } = setup();
    authentikAdmin.setPassword.mockRejectedValueOnce(new Error('authentik down'));

    await expect(service.finalize(INPUT)).rejects.toThrow('authentik down');

    expect(vault.store).not.toHaveBeenCalled();
    expect(chain.changeKey).not.toHaveBeenCalled();
  });

  it('пароль не попадает в аудит KeyRotated (без утечки секрета)', async () => {
    const { service, audit } = setup();
    await service.finalize({ ...INPUT, newPassword: 'super-secret-passphrase-xyz' });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('super-secret-passphrase-xyz');
  });

  it('old_pubkey best-effort: getAccount упал → ротация идёт, old_pubkey=null', async () => {
    const { service, chain, audit } = setup();
    chain.getAccount.mockRejectedValueOnce(new Error('rpc down'));

    await service.finalize(INPUT);

    expect(chain.changeKey).toHaveBeenCalled();
    const ctx = audit.record.mock.calls[0][0].context as Record<string, unknown>;
    expect(ctx.old_pubkey).toBeNull();
  });

  it('force_recovery: actor=chairman, trigger=force_recovery в аудите', async () => {
    const { service, audit } = setup();
    await service.finalize({ ...INPUT, trigger: 'force_recovery' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'chairman',
        context: expect.objectContaining({ trigger: 'force_recovery' }),
      }),
    );
  });
});
