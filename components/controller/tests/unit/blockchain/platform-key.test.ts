import { PrivateKey } from '@wharfkit/antelope';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { PlatformKeyMigrationService } from '~/application/system/services/platform-key-migration.service';
import { SystemStatus } from '~/application/system/dto/system-status.dto';
import config from '~/config/config';

/**
 * Ключ узла кооператива — разрешение platform (registrator::setplatform):
 * active = {ключ пайщика, <аккаунт>@platform}. Узел подписывает как active
 * ключом platform; смена ключа пайщика (changekey) узел не останавливает.
 */

const key = () => {
  const priv = PrivateKey.generate('K1');
  return { wif: priv.toWif(), pub: priv.toPublic().toLegacyString() };
};

const perm = (perm_name: string, parent: string, keys: string[], accounts: Array<[string, string]> = [], threshold = 1) => ({
  perm_name,
  parent,
  required_auth: {
    threshold,
    keys: keys.map((k) => ({ key: k, weight: 1 })),
    accounts: accounts.map(([actor, permission]) => ({ permission: { actor, permission }, weight: 1 })),
    waits: [],
  },
});

const account = (name: string, permissions: any[]) => ({ account_name: name, permissions });

function buildService(wif: string | null) {
  const vault = { getWif: jest.fn(async () => wif) };
  const service = new BlockchainService(
    { setContext: jest.fn(), info: jest.fn(), warn: jest.fn() } as any,
    { read: jest.fn(), activeUrl: jest.fn() } as any,
    vault as any
  );
  jest.spyOn(service, 'initialize').mockImplementation(() => undefined);
  const sent: any[][] = [];
  jest.spyOn(service, 'transact').mockImplementation(async (actions: any) => {
    sent.push(Array.isArray(actions) ? actions : [actions]);
    return {} as any;
  });
  return { service, sent };
}

describe('canSignAsActive — приём ключа узлом', () => {
  const { service } = buildService(null);
  const user = key();
  const node = key();

  it('ключ прямо в active — подписывает', () => {
    expect(service.canSignAsActive(account('coop', [perm('active', 'owner', [user.pub])]) as any, user.pub)).toBe(true);
  });

  it('ключ в platform, который входит в active своего аккаунта, — подписывает', () => {
    const acc = account('coop', [perm('active', 'owner', [user.pub], [['coop', 'platform']]), perm('platform', 'owner', [node.pub])]);
    expect(service.canSignAsActive(acc as any, node.pub)).toBe(true);
  });

  it('platform есть, но в active не входит — не подписывает', () => {
    const acc = account('coop', [perm('active', 'owner', [user.pub]), perm('platform', 'owner', [node.pub])]);
    expect(service.canSignAsActive(acc as any, node.pub)).toBe(false);
  });

  it('делегирование на чужой аккаунт ключом узла не считается', () => {
    const acc = account('coop', [perm('active', 'owner', [user.pub], [['other', 'platform']]), perm('platform', 'owner', [node.pub])]);
    expect(service.canSignAsActive(acc as any, node.pub)).toBe(false);
  });

  it('посторонний ключ — не подписывает', () => {
    const acc = account('coop', [perm('active', 'owner', [user.pub], [['coop', 'platform']]), perm('platform', 'owner', [node.pub])]);
    expect(service.canSignAsActive(acc as any, key().pub)).toBe(false);
  });

  it('вход пайщика (hasActiveKey) ключ узла по-прежнему не принимает', () => {
    const acc = account('coop', [perm('active', 'owner', [user.pub], [['coop', 'platform']]), perm('platform', 'owner', [node.pub])]);
    expect(service.hasActiveKey(acc as any, node.pub)).toBe(false);
  });
});

describe('changeKey — ключ узла закрепляется той же транзакцией', () => {
  const coopKey = key();
  const nodeKey = key();
  const change = { coopname: config.coopname, changer: config.coopname, username: 'partnercoop1', public_key: key().pub };

  it('кооператив без platform: сначала setplatform с нынешним ключом, затем changekey', async () => {
    const { service, sent } = buildService(coopKey.wif);
    jest.spyOn(service, 'getCooperative').mockResolvedValue({ username: 'partnercoop1' });
    jest.spyOn(service, 'getAccount').mockResolvedValue(account('partnercoop1', [perm('active', 'owner', [nodeKey.pub])]) as any);

    await service.changeKey(change as any);

    expect(sent).toHaveLength(1);
    expect(sent[0].map((a) => a.name)).toEqual(['setplatform', 'changekey']);
    expect(sent[0][0].data).toEqual({ coopname: config.coopname, username: 'partnercoop1', platform_key: nodeKey.pub, active_key: nodeKey.pub });
    expect(sent[0][0].authorization).toEqual([{ actor: config.coopname, permission: 'active' }]);
  });

  it('platform уже выпущен — только changekey', async () => {
    const { service, sent } = buildService(coopKey.wif);
    jest.spyOn(service, 'getCooperative').mockResolvedValue({ username: 'partnercoop1' });
    jest
      .spyOn(service, 'getAccount')
      .mockResolvedValue(account('partnercoop1', [perm('active', 'owner', [nodeKey.pub], [['partnercoop1', 'platform']]), perm('platform', 'owner', [nodeKey.pub])]) as any);

    await service.changeKey(change as any);

    expect(sent[0].map((a) => a.name)).toEqual(['changekey']);
  });

  it('аккаунт не кооператив — только changekey, аккаунт не читается', async () => {
    const { service, sent } = buildService(coopKey.wif);
    jest.spyOn(service, 'getCooperative').mockResolvedValue(null);
    const getAccount = jest.spyOn(service, 'getAccount');

    await service.changeKey(change as any);

    expect(sent[0].map((a) => a.name)).toEqual(['changekey']);
    expect(getAccount).not.toHaveBeenCalled();
  });

  it('в active не один ключ — не закрепляем (чей ключ узла, неизвестно), только changekey', async () => {
    const { service, sent } = buildService(coopKey.wif);
    jest.spyOn(service, 'getCooperative').mockResolvedValue({ username: 'partnercoop1' });
    jest.spyOn(service, 'getAccount').mockResolvedValue(account('partnercoop1', [perm('active', 'owner', [nodeKey.pub, key().pub])]) as any);

    await service.changeKey(change as any);

    expect(sent[0].map((a) => a.name)).toEqual(['changekey']);
  });
});

describe('ensureOwnPlatformKey — самомиграция узла', () => {
  const nodeKey = key();
  const own = (permissions: any[]) => account(config.coopname, permissions);

  it('ключа в хранилище нет — no-key, транзакций нет', async () => {
    const { service, sent } = buildService(null);
    await expect(service.ensureOwnPlatformKey()).resolves.toBe('no-key');
    expect(sent).toHaveLength(0);
  });

  it('platform уже есть — exists', async () => {
    const { service, sent } = buildService(nodeKey.wif);
    jest.spyOn(service, 'getAccount').mockResolvedValue(own([perm('active', 'owner', [nodeKey.pub]), perm('platform', 'owner', [nodeKey.pub])]) as any);
    await expect(service.ensureOwnPlatformKey()).resolves.toBe('exists');
    expect(sent).toHaveLength(0);
  });

  it('ключ хранилища уже не в active (ключ сменили) — key-not-active, транзакций нет', async () => {
    const { service, sent } = buildService(nodeKey.wif);
    jest.spyOn(service, 'getAccount').mockResolvedValue(own([perm('active', 'owner', [key().pub])]) as any);
    await expect(service.ensureOwnPlatformKey()).resolves.toBe('key-not-active');
    expect(sent).toHaveLength(0);
  });

  it('в active несколько ключей — shared-active: setplatform стёр бы чужой ключ', async () => {
    const { service, sent } = buildService(nodeKey.wif);
    jest.spyOn(service, 'getAccount').mockResolvedValue(own([perm('active', 'owner', [nodeKey.pub, key().pub])]) as any);
    await expect(service.ensureOwnPlatformKey()).resolves.toBe('shared-active');
    expect(sent).toHaveLength(0);
  });

  it('ключ узла — единственный в active: setplatform своей подписью, ключ тот же', async () => {
    const { service, sent } = buildService(nodeKey.wif);
    jest.spyOn(service, 'getAccount').mockResolvedValue(own([perm('active', 'owner', [nodeKey.pub])]) as any);
    await expect(service.ensureOwnPlatformKey()).resolves.toBe('issued');
    expect(sent).toHaveLength(1);
    expect(sent[0][0]).toMatchObject({
      account: 'registrator',
      name: 'setplatform',
      authorization: [{ actor: config.coopname, permission: 'active' }],
      data: { coopname: config.coopname, username: config.coopname, platform_key: nodeKey.pub, active_key: nodeKey.pub },
    });
  });
});

describe('PlatformKeyMigrationService — при старте узла', () => {
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn() };

  it('узел не установлен — к цепи не обращается', async () => {
    const blockchain = { ensureOwnPlatformKey: jest.fn() };
    const svc = new PlatformKeyMigrationService(logger as any, blockchain as any, { getMonoDocument: jest.fn(async () => ({ status: SystemStatus.install })) } as any);
    await svc.migrate();
    expect(blockchain.ensureOwnPlatformKey).not.toHaveBeenCalled();
  });

  it('узел установлен — закрепляет ключ', async () => {
    const blockchain = { ensureOwnPlatformKey: jest.fn(async () => 'issued') };
    const svc = new PlatformKeyMigrationService(logger as any, blockchain as any, { getMonoDocument: jest.fn(async () => ({ status: SystemStatus.active })) } as any);
    await svc.migrate();
    expect(blockchain.ensureOwnPlatformKey).toHaveBeenCalledTimes(1);
  });

  it('сбой цепи не роняет старт — предупреждение, повтор при следующем старте', async () => {
    const blockchain = { ensureOwnPlatformKey: jest.fn(async () => Promise.reject(new Error('chain down'))) };
    const svc = new PlatformKeyMigrationService(logger as any, blockchain as any, { getMonoDocument: jest.fn(async () => ({ status: SystemStatus.active })) } as any);
    await expect(svc.migrate()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
