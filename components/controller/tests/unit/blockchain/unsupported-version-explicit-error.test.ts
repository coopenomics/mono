/**
 * Story 6.5 (Epic 6): unit-тесты для:
 * - `UnsupportedContractVersionError` — носит контекст (contract/table/primary_key/block_num).
 * - `auditUnknownStatus` — пишет error в logger с ожидаемыми статусами.
 * - `AbstractEntitySyncService.processDelta` — strict-mode → throw, default → log.error + null.
 *
 * Конфиг strict-mode мокается через `jest.mock('~/config/config', ...)`.
 */

let strictMode = false;

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    get blockchain() {
      return { unsupported_version_strict: strictMode };
    },
  },
}));

import { AbstractEntitySyncService } from '~/shared/services/abstract-entity-sync.service';
import { UnsupportedContractVersionError } from '~/shared/sync/errors/unsupported-contract-version.error';
import { auditUnknownStatus } from '~/shared/sync/errors/audit-unknown-status';

function makeLoggerStub(): any {
  return {
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function makeMapperStub(canMap: boolean): any {
  return {
    extractSyncValue: jest.fn(() => 'sync-value'),
    extractSyncKey: jest.fn(() => 'id'),
    mapDeltaToBlockchainData: jest.fn(() => (canMap ? { v: 1 } : null)),
    getAllEventPatterns: jest.fn(() => []),
    getSupportedTableNames: jest.fn(() => []),
    getSupportedContractNames: jest.fn(() => []),
  };
}

class TestSyncService extends AbstractEntitySyncService<any, any> {
  protected readonly entityName = 'TestEntity';
}

describe('Story 6.5: UnsupportedContractVersionError', () => {
  it('конструктор сохраняет entityName и context', () => {
    const err = new UnsupportedContractVersionError('Project', {
      contract: 'capital',
      table: 'projects',
      primary_key: 42,
      block_num: 100,
    });
    expect(err.name).toBe('UnsupportedContractVersionError');
    expect(err.entityName).toBe('Project');
    expect(err.context.primary_key).toBe(42);
    expect(err.message).toContain('Project');
    expect(err.message).toContain('"table":"projects"');
  });
});

describe('Story 6.5: auditUnknownStatus', () => {
  it('пишет logger.error с контекстом и списком ожидаемых статусов', () => {
    const logger = makeLoggerStub();
    auditUnknownStatus('Project', 'something-unknown', logger, ['pending', 'active']);
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [msg, meta] = logger.error.mock.calls[0];
    expect(msg).toContain('UNKNOWN_ENTITY_STATUS');
    expect(msg).toContain('Project');
    expect(msg).toContain('something-unknown');
    expect(msg).toContain('pending');
    expect(meta).toMatchObject({ entityName: 'Project', receivedStatus: 'something-unknown' });
  });

  it('без allowedStatuses пишет "не указано"', () => {
    const logger = makeLoggerStub();
    auditUnknownStatus('Other', 'x', logger);
    expect(logger.error.mock.calls[0][0]).toContain('не указано');
  });
});

describe('Story 6.5: processDelta — silent loss заменён audit + опциональный throw', () => {
  const delta = {
    contract: 'capital',
    table: 'projects',
    primary_key: 'abc',
    block_num: 100,
    present: true,
    value: {},
  } as any;

  beforeEach(() => {
    strictMode = false;
  });

  it('non-strict: mapper вернул null → logger.error("UNSUPPORTED_CONTRACT_VERSION", ...) + return null', async () => {
    const logger = makeLoggerStub();
    const repo: any = {};
    const service = new TestSyncService(repo, makeMapperStub(false), logger);

    const result = await service.processDelta(delta);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalled();
    expect(logger.error.mock.calls[0][0]).toContain('UNSUPPORTED_CONTRACT_VERSION');
  });

  it('strict: mapper вернул null → throw UnsupportedContractVersionError (парсер не ACK\'нет)', async () => {
    strictMode = true;
    const logger = makeLoggerStub();
    const repo: any = {};
    const service = new TestSyncService(repo, makeMapperStub(false), logger);

    await expect(service.processDelta(delta)).rejects.toBeInstanceOf(UnsupportedContractVersionError);
    expect(logger.error).toHaveBeenCalled();
  });

  it('mapper вернул данные → happy-path продолжается (handleSyncDelta)', async () => {
    const logger = makeLoggerStub();
    const repo: any = {
      findBySyncKey: jest.fn(async () => null),
      createIfNotExists: jest.fn(async () => undefined),
    };
    const service = new TestSyncService(repo, makeMapperStub(true), logger);
    const result = await service.processDelta(delta);
    expect(result).not.toBeNull();
    expect(repo.createIfNotExists).toHaveBeenCalled();
  });
});
