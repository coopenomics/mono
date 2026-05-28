/**
 * Unit-тест Story 4.4: AbstractEntitySyncService.handleFork — порядок шагов.
 *
 * Контрактные инварианты:
 * - Порядок: archiveInvalidatedSince → restoreFromVersions → archiveInvalidatedVersionsSince.
 * - forkEventId пробрасывается в archive-методы.
 * - Если repo НЕ реализует archiveInvalidatedSince — fallback на findByBlockNumGreaterThan + deleteByBlockNumGreaterThan (бэк-совместимость для off-chain).
 * - Ошибка в archiveInvalidatedSince re-throw'ится, restore не вызывается.
 */

import { AbstractEntitySyncService } from '~/shared/services/abstract-entity-sync.service';

function makeLoggerStub(): any {
  return {
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function makeMapperStub(): any {
  return {
    extractSyncValue: jest.fn(),
    extractSyncKey: jest.fn(() => 'id'),
    mapDeltaToBlockchainData: jest.fn(),
    getAllEventPatterns: jest.fn(() => []),
    getSupportedTableNames: jest.fn(() => []),
    getSupportedContractNames: jest.fn(() => []),
  };
}

class TestSyncService extends AbstractEntitySyncService<any, any> {
  protected readonly entityName = 'TestEntity';
}

describe('AbstractEntitySyncService.handleFork (Story 4.4)', () => {
  it('Story 4.4 happy-path: archiveInvalidatedSince → restoreFromVersions → archiveInvalidatedVersionsSince; eventId пробрасывается', async () => {
    const calls: Array<{ name: string; args: any[] }> = [];
    const repo: any = {
      archiveInvalidatedSince: jest.fn(async (...args) => {
        calls.push({ name: 'archiveInvalidatedSince', args });
        return 3;
      }),
      restoreFromVersions: jest.fn(async (...args) => {
        calls.push({ name: 'restoreFromVersions', args });
      }),
      archiveInvalidatedVersionsSince: jest.fn(async (...args) => {
        calls.push({ name: 'archiveInvalidatedVersionsSince', args });
        return 5;
      }),
    };

    const service = new TestSyncService(repo, makeMapperStub(), makeLoggerStub());

    await service.handleFork(100, 'c1:fork:100:beef');

    expect(calls.map((c) => c.name)).toEqual([
      'archiveInvalidatedSince',
      'restoreFromVersions',
      'archiveInvalidatedVersionsSince',
    ]);
    expect(repo.archiveInvalidatedSince).toHaveBeenCalledWith(100, 'c1:fork:100:beef');
    expect(repo.restoreFromVersions).toHaveBeenCalledWith(100);
    expect(repo.archiveInvalidatedVersionsSince).toHaveBeenCalledWith(100, 'c1:fork:100:beef');
  });

  it('Story 4.4: forkEventId необязателен — без него archive получают undefined', async () => {
    const repo: any = {
      archiveInvalidatedSince: jest.fn(async () => 0),
      restoreFromVersions: jest.fn(async () => undefined),
      archiveInvalidatedVersionsSince: jest.fn(async () => 0),
    };

    const service = new TestSyncService(repo, makeMapperStub(), makeLoggerStub());

    await service.handleFork(100);

    expect(repo.archiveInvalidatedSince).toHaveBeenCalledWith(100, undefined);
    expect(repo.archiveInvalidatedVersionsSince).toHaveBeenCalledWith(100, undefined);
  });

  it('Story 4.4 fallback: репо без archive-методов → старая пара findByBlockNumGreaterThan + deleteByBlockNumGreaterThan (off-chain совместимость)', async () => {
    const repo: any = {
      findByBlockNumGreaterThan: jest.fn(async () => [{ _id: 'e1' }, { _id: 'e2' }]),
      deleteByBlockNumGreaterThan: jest.fn(async () => undefined),
      restoreFromVersions: jest.fn(async () => undefined),
    };

    const service = new TestSyncService(repo, makeMapperStub(), makeLoggerStub());

    await service.handleFork(100, 'eventid');

    expect(repo.findByBlockNumGreaterThan).toHaveBeenCalledWith(100);
    expect(repo.deleteByBlockNumGreaterThan).toHaveBeenCalledWith(100);
    expect(repo.restoreFromVersions).toHaveBeenCalledWith(100);
  });

  it('Story 4.4: ошибка archiveInvalidatedSince → re-throw, restoreFromVersions и archiveVersions НЕ вызываются', async () => {
    const repo: any = {
      archiveInvalidatedSince: jest.fn(async () => {
        throw new Error('archive PG outage');
      }),
      restoreFromVersions: jest.fn(async () => undefined),
      archiveInvalidatedVersionsSince: jest.fn(async () => 0),
    };

    const service = new TestSyncService(repo, makeMapperStub(), makeLoggerStub());

    await expect(service.handleFork(100, 'eventid')).rejects.toThrow('archive PG outage');

    expect(repo.restoreFromVersions).not.toHaveBeenCalled();
    expect(repo.archiveInvalidatedVersionsSince).not.toHaveBeenCalled();
  });
});
