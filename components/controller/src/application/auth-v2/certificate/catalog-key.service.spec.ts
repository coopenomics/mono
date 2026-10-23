import { CATALOG_PERMISSION, CatalogKeyService } from './catalog-key.service';

const mockConfig = { coopname: 'romashka', apps_catalog_auth: { url: 'http://catalog-delivery:3001' as string | undefined } };
jest.mock('~/config/config', () => ({ __esModule: true, default: mockConfig }));

/**
 * Ключ входа в каталог приложений (487-34): узел выпускает его сам, хранит в
 * хранилище отдельным правом `catalog` и публикует `<coop>@catalog`. Раньше
 * ключ лежал в окружении (`CATALOG_SIGNING_KEY`) открытым текстом.
 */
function makeService(overrides: { stored?: string | null; onChain?: string | null; publishThrows?: boolean } = {}) {
  const blockchainPort = {
    getPermissionPublicKey: jest.fn(async () => overrides.onChain ?? null),
    publishPermission: jest.fn(async () => {
      if (overrides.publishThrows) throw new Error('duplicate transaction');
    }),
  };
  const vault = {
    getWif: jest.fn(async () => (overrides.stored === undefined ? 'WIF' : overrides.stored)),
    setWif: jest.fn(async () => true),
  };
  const crypto = {
    publicKeyOf: jest.fn((wif: string) => (wif === 'NEW' ? 'PUB_NEW' : 'PUB')),
    normalizePublicKey: jest.fn((k: string) => k),
    generate: jest.fn(() => 'NEW'),
  };
  const logger = { log: jest.fn(), warn: jest.fn() };
  const service = new CatalogKeyService(blockchainPort as any, vault as any, crypto as any, logger as any);
  return { service, blockchainPort, vault, logger };
}

describe('CatalogKeyService', () => {
  beforeEach(() => {
    mockConfig.apps_catalog_auth.url = 'http://catalog-delivery:3001';
  });

  it('happy: ключа нет — выпускается, ложится в хранилище правом catalog и публикуется разрешением catalog', async () => {
    const { service, blockchainPort, vault } = makeService({ stored: null });
    await expect(service.ensurePublished()).resolves.toEqual({ published: true, publicKey: 'PUB_NEW' });
    expect(vault.setWif).toHaveBeenCalledWith({ username: 'romashka', wif: 'NEW', permission: 'catalog' });
    expect(blockchainPort.publishPermission).toHaveBeenCalledWith('romashka', CATALOG_PERMISSION, 'PUB_NEW');
  });

  it('happy: ключ в хранилище и в цепи совпадает — в цепь не пишем', async () => {
    const { service, blockchainPort, vault } = makeService({ onChain: 'PUB' });
    await expect(service.ensurePublished()).resolves.toEqual({ published: false, publicKey: 'PUB' });
    expect(blockchainPort.publishPermission).not.toHaveBeenCalled();
    expect(vault.setWif).not.toHaveBeenCalled();
  });

  it('side: в цепи другой ключ — публикуется ключ из хранилища', async () => {
    const { service, blockchainPort } = makeService({ onChain: 'PUB_OLD' });
    await service.ensurePublished();
    expect(blockchainPort.publishPermission).toHaveBeenCalledWith('romashka', 'catalog', 'PUB');
  });

  it('break: два одновременных вызова отправляют одну updateauth', async () => {
    const { service, blockchainPort } = makeService();
    await Promise.all([service.ensurePublished(), service.ensurePublished()]);
    expect(blockchainPort.publishPermission).toHaveBeenCalledTimes(1);
  });

  it('side: повтор отвергнут цепью, но нужный ключ уже стоит — дело сделано', async () => {
    const { service, blockchainPort } = makeService({ publishThrows: true });
    blockchainPort.getPermissionPublicKey.mockResolvedValueOnce(null as never).mockResolvedValueOnce('PUB' as never);
    await expect(service.ensurePublished()).resolves.toEqual({ published: true, publicKey: 'PUB' });
  });

  it('break: публикация не прошла и ключа в цепи нет — старт не падает, в журнале предупреждение', async () => {
    const { service, logger } = makeService({ publishThrows: true });
    await expect(service.publishSafely()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('break: узел без каталога ключ не выпускает и в цепь не пишет', async () => {
    mockConfig.apps_catalog_auth.url = undefined;
    const { service, blockchainPort, vault } = makeService({ stored: null });
    await service.publishSafely();
    expect(vault.getWif).not.toHaveBeenCalled();
    expect(blockchainPort.publishPermission).not.toHaveBeenCalled();
  });
});
