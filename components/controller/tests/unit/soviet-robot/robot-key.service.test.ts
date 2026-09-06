/**
 * Хранилище ключей робота: ключ принимается только от члена совета, только для
 * отдельного разрешения и только если публичная часть стоит в этом разрешении в цепи.
 */
import { PrivateKey, KeyType } from '@wharfkit/antelope';
import { RobotKeyService } from '~/extensions/soviet-robot/application/services/robot-key.service';

// В тесте узел не запаздывает — повторные чтения без пауз.
RobotKeyService.PERMISSION_READ_PAUSE_MS = 0;

function makeLogger() {
  return { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
}

function build(chainPublicKey: string | null, members = ['ant', 'petr']) {
  const stored: Record<string, any> = {};
  const repo = {
    findByMember: jest.fn(async (_c: string, m: string) => stored[m] ?? null),
    findAll: jest.fn(async () => Object.values(stored)),
    upsert: jest.fn(async (data: any) => {
      stored[data.member] = { ...data, updated_at: new Date() };
      return stored[data.member];
    }),
    deleteByMember: jest.fn(async (_c: string, m: string) => {
      const had = !!stored[m];
      delete stored[m];
      return had;
    }),
  } as any;
  const cipher = { encrypt: (s: string) => `enc:${s}`, decrypt: (s: string) => s.replace(/^enc:/, '') } as any;
  const accounts = {
    getAccount: jest.fn(async () => ({
      blockchain_account: {
        permissions: chainPublicKey
          ? [{ perm_name: 'robot', parent: 'active', required_auth: { threshold: 1, keys: [{ key: chainPublicKey, weight: 1 }], accounts: [], waits: [] } }]
          : [],
      },
    })),
  } as any;
  const chain = { getSovietBoard: jest.fn(async () => ({ members: members.map((username) => ({ username })) })) } as any;
  return { service: new RobotKeyService(repo, cipher, accounts, chain, makeLogger()), repo };
}

describe('RobotKeyService.delegateKey', () => {
  const key = PrivateKey.generate(KeyType.K1);
  const wif = key.toWif();
  const pub = key.toPublic().toString();

  it('принимает ключ, стоящий в разрешении робота, и хранит его зашифрованным', async () => {
    const { service, repo } = build(pub);
    const status = await service.delegateKey('voskhod', 'petr', wif);
    expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ member: 'petr', permission_name: 'robot', encrypted_wif: `enc:${wif}`, public_key: pub }));
    expect(status).toMatchObject({ has_key: true, chain_has_permission: true, chain_key_matches: true });
    expect(JSON.stringify(status)).not.toContain(wif);
    await expect(service.getWif('voskhod', 'petr')).resolves.toEqual({ wif, permission_name: 'robot' });
  });

  it('сравнивает ключи в разных представлениях', async () => {
    const legacy = key.toPublic().toLegacyString();
    const { service } = build(legacy);
    await expect(service.delegateKey('voskhod', 'petr', wif)).resolves.toMatchObject({ chain_key_matches: true });
  });

  it('отказывает не члену совета', async () => {
    const { service } = build(pub);
    await expect(service.delegateKey('voskhod', 'stranger', wif)).rejects.toThrow('члена совета');
  });

  it('отказывает разрешению active', async () => {
    const { service } = build(pub);
    await expect(service.delegateKey('voskhod', 'petr', wif, 'active')).rejects.toThrow('отдельное разрешение');
  });

  it('отказывает, если разрешения нет в цепи или ключ чужой', async () => {
    const { service: noPermission } = build(null);
    await expect(noPermission.delegateKey('voskhod', 'petr', wif)).rejects.toThrow('нет разрешения');
    const { service: foreign } = build(PrivateKey.generate(KeyType.K1).toPublic().toString());
    await expect(foreign.delegateKey('voskhod', 'petr', wif)).rejects.toThrow('не принадлежит');
  });

  it('отзыв удаляет ключ, статус показывает отсутствие', async () => {
    const { service } = build(pub);
    await service.delegateKey('voskhod', 'petr', wif);
    await expect(service.revokeKey('voskhod', 'petr')).resolves.toBe(true);
    await expect(service.getStatus('voskhod', 'petr')).resolves.toMatchObject({ has_key: false, chain_has_permission: true, chain_key_matches: false });
  });
});
