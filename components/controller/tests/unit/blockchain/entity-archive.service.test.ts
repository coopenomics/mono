/**
 * Unit-тесты Story 4.4: EntityVersioningService.archiveAndDeleteLiveAfterFork /
 * archiveAndDeleteVersionsAfterFork.
 *
 * Контрактные инварианты:
 * - SELECT WHERE block_num > N + INSERT в архив + DELETE из исходной таблицы происходят
 *   в ОДНОЙ транзакции (DataSource.transaction).
 * - При нулевом count — нет INSERT и нет DELETE (ранний return).
 * - forkEventId пробрасывается в архив (NULL допустим).
 * - count возвращается корректно.
 * - archive-методы НЕ задействуют entityVersionRepository.saveVersion (не путать с saveVersionBeforeUpdate).
 */

import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import { InvalidatedEntityTypeormEntity } from '~/shared/sync/entities/invalidated-entity.typeorm-entity';
import { InvalidatedEntityVersionTypeormEntity } from '~/shared/sync/entities/invalidated-entity-version.typeorm-entity';
import { EntityVersionTypeormEntity } from '~/shared/sync/entities/entity-version.typeorm-entity';

interface MockRepo {
  find: jest.Mock;
  delete: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  createQueryBuilder?: jest.Mock;
}

function makeMockRepo(): MockRepo {
  return {
    find: jest.fn(),
    delete: jest.fn(async () => ({ affected: 0 })),
    save: jest.fn(async (x) => x),
    create: jest.fn((x) => x),
  };
}

function makeMockDataSource(repoMap: Map<any, MockRepo>): any {
  return {
    transaction: jest.fn(async (cb: (manager: any) => Promise<any>) => {
      const manager = {
        getRepository: (target: any) => {
          const repo = repoMap.get(target);
          if (!repo) throw new Error(`No mock repo for target ${target?.name ?? target}`);
          return repo;
        },
      };
      return cb(manager);
    }),
  };
}

describe('EntityVersioningService.archiveAndDeleteLiveAfterFork (Story 4.4)', () => {
  it('SELECT block_num > N → INSERT в архив → DELETE из исходной таблицы; count = найденные ряды', async () => {
    const liveTarget = class FakeProject {};
    const liveRepo: MockRepo = makeMockRepo();
    const archiveRepo: MockRepo = makeMockRepo();

    const rows = [
      { _id: 'p1', block_num: 200, name: 'A' },
      { _id: 'p2', block_num: 201, name: 'B' },
    ];
    liveRepo.find.mockResolvedValueOnce(rows);

    const liveRepoOuter = { target: liveTarget } as any;
    const dataSource = makeMockDataSource(
      new Map<any, MockRepo>([
        [liveTarget, liveRepo],
        [InvalidatedEntityTypeormEntity, archiveRepo],
      ])
    );

    const service = new EntityVersioningService(
      {} as any,
      {} as any,
      {} as any,
      dataSource
    );

    const count = await service.archiveAndDeleteLiveAfterFork(
      liveRepoOuter,
      'capital_projects',
      100,
      'c1:fork:100:abc12345'
    );

    expect(count).toBe(2);
    expect(liveRepo.find).toHaveBeenCalledTimes(1);
    expect(archiveRepo.save).toHaveBeenCalledTimes(1);
    const archived = archiveRepo.save.mock.calls[0][0];
    expect(archived).toHaveLength(2);
    expect(archived[0]).toMatchObject({
      entity_table: 'capital_projects',
      entity_id: 'p1',
      invalidated_by_block: 100,
      fork_event_id: 'c1:fork:100:abc12345',
    });
    expect(archived[0].data).toMatchObject({ name: 'A', block_num: 200 });
    expect(liveRepo.delete).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('нет рядов для архивирования — нет INSERT, нет DELETE, count=0', async () => {
    const liveTarget = class FakeProject {};
    const liveRepo: MockRepo = makeMockRepo();
    const archiveRepo: MockRepo = makeMockRepo();
    liveRepo.find.mockResolvedValueOnce([]);

    const dataSource = makeMockDataSource(
      new Map<any, MockRepo>([
        [liveTarget, liveRepo],
        [InvalidatedEntityTypeormEntity, archiveRepo],
      ])
    );

    const service = new EntityVersioningService({} as any, {} as any, {} as any, dataSource);

    const count = await service.archiveAndDeleteLiveAfterFork(
      { target: liveTarget } as any,
      'capital_projects',
      100,
      null
    );

    expect(count).toBe(0);
    expect(archiveRepo.save).not.toHaveBeenCalled();
    expect(liveRepo.delete).not.toHaveBeenCalled();
  });

  it('forkEventId=undefined → в архиве fork_event_id=null (NULL допустим, не required)', async () => {
    const liveTarget = class FakeProject {};
    const liveRepo: MockRepo = makeMockRepo();
    const archiveRepo: MockRepo = makeMockRepo();
    liveRepo.find.mockResolvedValueOnce([{ _id: 'p1', block_num: 200 }]);

    const dataSource = makeMockDataSource(
      new Map<any, MockRepo>([
        [liveTarget, liveRepo],
        [InvalidatedEntityTypeormEntity, archiveRepo],
      ])
    );

    const service = new EntityVersioningService({} as any, {} as any, {} as any, dataSource);

    await service.archiveAndDeleteLiveAfterFork({ target: liveTarget } as any, 'capital_projects', 100);

    const archived = archiveRepo.save.mock.calls[0][0];
    expect(archived[0].fork_event_id).toBeNull();
  });
});

describe('EntityVersioningService.archiveAndDeleteVersionsAfterFork (Story 4.4)', () => {
  it('SELECT entity_versions WHERE entity_table AND block_num > N → INSERT → DELETE по ids', async () => {
    const versionsRepo: any = {
      createQueryBuilder: jest.fn(() => versionsRepo),
      where: jest.fn(() => versionsRepo),
      andWhere: jest.fn(() => versionsRepo),
      getMany: jest.fn(async () => [
        {
          id: 'v1',
          entity_table: 'capital_projects',
          entity_id: 'p1',
          previous_data: { name: 'A_old' },
          block_num: 150,
          change_type: 'update',
          metadata: null,
        },
        {
          id: 'v2',
          entity_table: 'capital_projects',
          entity_id: 'p2',
          previous_data: { name: 'B_old' },
          block_num: null,
          change_type: 'update',
          metadata: { foo: 1 },
        },
      ]),
      delete: jest.fn(() => versionsRepo),
      from: jest.fn(() => versionsRepo),
      whereInIds: jest.fn(() => versionsRepo),
      execute: jest.fn(async () => ({ affected: 2 })),
      save: jest.fn(async (x) => x),
      create: jest.fn((x) => x),
    };

    const archiveRepo: MockRepo = makeMockRepo();

    const dataSource = makeMockDataSource(
      new Map<any, MockRepo>([
        [EntityVersionTypeormEntity, versionsRepo],
        [InvalidatedEntityVersionTypeormEntity, archiveRepo],
      ])
    );

    const service = new EntityVersioningService({} as any, {} as any, {} as any, dataSource);

    const count = await service.archiveAndDeleteVersionsAfterFork(
      'capital_projects',
      100,
      'c1:fork:100:deadbeef'
    );

    expect(count).toBe(2);
    expect(archiveRepo.save).toHaveBeenCalledTimes(1);
    const archived = archiveRepo.save.mock.calls[0][0];
    expect(archived).toHaveLength(2);
    expect(archived[0]).toMatchObject({
      entity_table: 'capital_projects',
      entity_id: 'p1',
      previous_data: { name: 'A_old' },
      original_block_num: 150,
      invalidated_by_block: 100,
      fork_event_id: 'c1:fork:100:deadbeef',
      change_type: 'update',
    });
    // v2 имел block_num=null → original_block_num=null
    expect(archived[1].original_block_num).toBeNull();
    expect(versionsRepo.whereInIds).toHaveBeenCalledWith(['v1', 'v2']);
    expect(versionsRepo.execute).toHaveBeenCalledTimes(1);
  });

  it('нет версий для архивирования — нет INSERT, нет DELETE', async () => {
    const versionsRepo: any = {
      createQueryBuilder: jest.fn(() => versionsRepo),
      where: jest.fn(() => versionsRepo),
      andWhere: jest.fn(() => versionsRepo),
      getMany: jest.fn(async () => []),
    };
    const archiveRepo: MockRepo = makeMockRepo();

    const dataSource = makeMockDataSource(
      new Map<any, MockRepo>([
        [EntityVersionTypeormEntity, versionsRepo],
        [InvalidatedEntityVersionTypeormEntity, archiveRepo],
      ])
    );

    const service = new EntityVersioningService({} as any, {} as any, {} as any, dataSource);

    const count = await service.archiveAndDeleteVersionsAfterFork('capital_projects', 100, null);

    expect(count).toBe(0);
    expect(archiveRepo.save).not.toHaveBeenCalled();
  });
});
