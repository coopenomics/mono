import { CertKeyService } from './cert-key.service';

/**
 * Кейс 2026-08-19: право заверения доводят до цепи два хука старта — этот сервис и
 * `EndorsementService`. Nest запускает хуки провайдеров одного модуля разом, оба
 * видели «ключа в цепи нет» и отправляли одинаковую `updateauth`. Одинаковые данные
 * в одну секунду дают одинаковый идентификатор транзакции, цепь отвергала вторую как
 * повторную, и вместе с ней падала вся сборка цепочки доверия: якорь не заверял
 * кооператив, а в кабинете удостоверение значилось неподтверждённым.
 */
function makeService(overrides: { onChain?: string | null; publishThrows?: boolean } = {}) {
  const blockchainPort = {
    getCertPublicKey: jest.fn(async () => overrides.onChain ?? null),
    publishCertPermission: jest.fn(async () => {
      if (overrides.publishThrows) throw new Error('duplicate transaction');
    }),
  };
  const vault = {
    getWif: jest.fn(async () => 'WIF'),
    setWif: jest.fn(async () => true),
  };
  const crypto = {
    publicKeyOf: jest.fn(() => 'PUB'),
    normalizePublicKey: jest.fn((k: string) => k),
    pemToChainKey: jest.fn(() => 'WIF'),
    generate: jest.fn(() => 'WIF'),
    toSigningKey: jest.fn(),
  };
  const logger = { log: jest.fn(), warn: jest.fn() };

  const service = new CertKeyService(blockchainPort as any, vault as any, crypto as any, logger as any);
  return { service, blockchainPort, vault, logger };
}

describe('CertKeyService.ensurePublished', () => {
  it('два одновременных вызова публикуют ключ ровно один раз', async () => {
    const { service, blockchainPort } = makeService({ onChain: null });

    await Promise.all([service.ensurePublished(), service.ensurePublished()]);

    expect(blockchainPort.publishCertPermission).toHaveBeenCalledTimes(1);
  });

  it('после завершения публикации следующий вызов идёт заново и видит ключ в цепи', async () => {
    const { service, blockchainPort } = makeService({ onChain: null });
    await service.ensurePublished();

    blockchainPort.getCertPublicKey.mockResolvedValue('PUB' as never);
    await expect(service.ensurePublished()).resolves.toEqual({ published: false, publicKey: 'PUB' });
    expect(blockchainPort.publishCertPermission).toHaveBeenCalledTimes(1);
  });

  it('ключ уже в цепи — в цепь не пишем', async () => {
    const { service, blockchainPort } = makeService({ onChain: 'PUB' });

    await expect(service.ensurePublished()).resolves.toEqual({ published: false, publicKey: 'PUB' });
    expect(blockchainPort.publishCertPermission).not.toHaveBeenCalled();
  });

  it('публикация отвергнута, но в цепи оказался тот же ключ — считаем дело сделанным', async () => {
    const { service, blockchainPort } = makeService({ onChain: null, publishThrows: true });
    blockchainPort.getCertPublicKey
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce('PUB' as never);

    await expect(service.ensurePublished()).resolves.toEqual({ published: true, publicKey: 'PUB' });
  });

  it('публикация отвергнута, а в цепи чужой ключ — это настоящий сбой', async () => {
    const { service, blockchainPort } = makeService({ onChain: null, publishThrows: true });
    blockchainPort.getCertPublicKey
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce('OTHER' as never);

    await expect(service.ensurePublished()).rejects.toThrow('duplicate transaction');
  });
});
