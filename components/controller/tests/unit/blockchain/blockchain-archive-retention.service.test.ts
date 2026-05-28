/**
 * Unit-тесты Story 4.4: BlockchainArchiveRetentionService.cleanup.
 *
 * Контрактные инварианты:
 * - LIB читается через BlockchainService.getInfo() (вариант C, без локальной эвристики).
 * - threshold = LIB - RETENTION_HORIZON_BLOCKS (1000, хардкод).
 * - При threshold <= 0 → skip + log (свежезапущенная testnet).
 * - При config.blockchain.archive_retention_enabled=false → ранний return, getInfo НЕ вызывается.
 * - При ошибке getInfo → skip + warn (без re-throw — фоновая задача не должна валиться).
 * - Удаление идёт ОДНОВРЕМЕННО для entities и для versions через два независимых repo.
 */

import { BlockchainArchiveRetentionService } from '~/shared/sync/services/blockchain-archive-retention.service';

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    blockchain: {
      archive_retention_enabled: true,
      archive_retention_cron: '0 * * * *',
    },
  },
}));

function makeLoggerStub(): any {
  return {
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function makeBlockchainServiceStub(lib: number): any {
  return {
    getInfo: jest.fn(async () => ({
      last_irreversible_block_num: lib,
      head_block_num: lib + 100,
    })),
  };
}

function makeRepoStub(): any {
  return {
    deleteOlderThan: jest.fn(async () => 0),
  };
}

describe('BlockchainArchiveRetentionService.cleanup (Story 4.4)', () => {
  it('LIB=100500: threshold=99500 (LIB-1000), удаляет архив старше threshold', async () => {
    const bc = makeBlockchainServiceStub(100500);
    const entityRepo = makeRepoStub();
    const versionRepo = makeRepoStub();
    entityRepo.deleteOlderThan.mockResolvedValueOnce(42);
    versionRepo.deleteOlderThan.mockResolvedValueOnce(17);

    const service = new BlockchainArchiveRetentionService(bc, entityRepo, versionRepo, makeLoggerStub());

    await service.cleanup();

    expect(bc.getInfo).toHaveBeenCalledTimes(1);
    expect(entityRepo.deleteOlderThan).toHaveBeenCalledWith(99500);
    expect(versionRepo.deleteOlderThan).toHaveBeenCalledWith(99500);
  });

  it('LIB=500 (< 1000): threshold ≤ 0 — skip без вызова deleteOlderThan', async () => {
    const bc = makeBlockchainServiceStub(500);
    const entityRepo = makeRepoStub();
    const versionRepo = makeRepoStub();

    const service = new BlockchainArchiveRetentionService(bc, entityRepo, versionRepo, makeLoggerStub());

    await service.cleanup();

    expect(bc.getInfo).toHaveBeenCalledTimes(1);
    expect(entityRepo.deleteOlderThan).not.toHaveBeenCalled();
    expect(versionRepo.deleteOlderThan).not.toHaveBeenCalled();
  });

  it('LIB=1000 (= 1000): threshold = 0, тоже skip', async () => {
    const bc = makeBlockchainServiceStub(1000);
    const entityRepo = makeRepoStub();
    const versionRepo = makeRepoStub();

    const service = new BlockchainArchiveRetentionService(bc, entityRepo, versionRepo, makeLoggerStub());

    await service.cleanup();

    expect(entityRepo.deleteOlderThan).not.toHaveBeenCalled();
  });

  it('archive_retention_enabled=false: getInfo НЕ вызывается, deleteOlderThan НЕ вызывается', async () => {
    const config = (await import('~/config/config')).default;
    (config as any).blockchain.archive_retention_enabled = false;

    try {
      const bc = makeBlockchainServiceStub(100500);
      const entityRepo = makeRepoStub();
      const versionRepo = makeRepoStub();

      const service = new BlockchainArchiveRetentionService(bc, entityRepo, versionRepo, makeLoggerStub());

      await service.cleanup();

      expect(bc.getInfo).not.toHaveBeenCalled();
      expect(entityRepo.deleteOlderThan).not.toHaveBeenCalled();
      expect(versionRepo.deleteOlderThan).not.toHaveBeenCalled();
    } finally {
      (config as any).blockchain.archive_retention_enabled = true;
    }
  });

  it('ошибка getInfo: cleanup НЕ бросает, warn + skip (фоновая задача переживёт сбой ноды)', async () => {
    const bc = {
      getInfo: jest.fn(async () => {
        throw new Error('RPC timeout');
      }),
    };
    const entityRepo = makeRepoStub();
    const versionRepo = makeRepoStub();
    const logger = makeLoggerStub();

    const service = new BlockchainArchiveRetentionService(bc as any, entityRepo, versionRepo, logger);

    await expect(service.cleanup()).resolves.toBeUndefined();
    expect(entityRepo.deleteOlderThan).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
