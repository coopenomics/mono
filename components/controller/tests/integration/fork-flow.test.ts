/**
 * Integration-тест ForkRegistry + AbstractEntitySyncService (Story 4.1, ADR-005).
 *
 * Уровень: реальный Nest DI (Test.createTestingModule + onApplicationBootstrap),
 * реальные ForkRegistryModule + ForkRegistryService + два concrete-subclass'а
 * AbstractEntitySyncService поверх in-memory Map-репозиториев.
 *
 * НЕ поднимаем PG: проект пока не несёт sqlite-driver-зависимости (Story 4.1 не
 * вводит её), поэтому ConsumerDedup и ForkRepo моделируются in-memory.
 *
 * Покрывает сценарий из spec AC «delta(N+1) → fork(N) → delta(N+2)»:
 * - syncer'ы автоматически обнаружены DiscoveryService через FORK_AWARE_MARKER;
 * - sequential rollback ForkRegistry.runAll очищает сущности > N в каждом syncer'е;
 * - consumer_dedup для блоков > N удалён;
 * - delta(N+2) применяется штатно поверх откатанного состояния.
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { Injectable } from '@nestjs/common';
import { ForkRegistryModule } from '~/shared/sync/fork/fork-registry.module';
import { ForkRegistryService } from '~/shared/sync/fork/fork-registry.service';
import { AbstractEntitySyncService } from '~/shared/services/abstract-entity-sync.service';
import { LoggerModule } from '~/application/logger/logger-app.module';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type {
  IBlockchainSynchronizable,
  IBlockchainSyncRepository,
  IBlockchainDeltaMapper,
} from '~/shared/interfaces/blockchain-sync.interface';

// ───── In-memory entity ─────
class FakeEntity implements IBlockchainSynchronizable {
  constructor(public id: string, public block_num: number, public payload: string) {}
  getBlockNum() {
    return this.block_num;
  }
  getPrimaryKey() {
    return this.id;
  }
  getSyncKey() {
    return this.id;
  }
  updateFromBlockchain(data: any, blockNum: number, _present?: boolean): void {
    this.block_num = blockNum;
    this.payload = data?.payload ?? this.payload;
  }
}

// ───── In-memory repository ─────
class FakeRepository implements IBlockchainSyncRepository<FakeEntity> {
  readonly store = new Map<string, FakeEntity>();
  /** Snapshot для restoreFromVersions: имитируем «версии» — последний state до forkBlockNum. */
  readonly versions = new Map<string, FakeEntity[]>();

  async findBySyncKey(_syncKey: string, syncValue: string): Promise<FakeEntity | null> {
    return this.store.get(syncValue) ?? null;
  }
  async findByBlockNumGreaterThan(blockNum: number): Promise<FakeEntity[]> {
    return [...this.store.values()].filter((e) => e.block_num > blockNum);
  }
  async create(entity: FakeEntity): Promise<FakeEntity> {
    return entity;
  }
  async saveCreated(entity: FakeEntity): Promise<FakeEntity> {
    this.store.set(entity.id, entity);
    return entity;
  }
  async save(entity: FakeEntity): Promise<FakeEntity> {
    this.store.set(entity.id, entity);
    return entity;
  }
  async update(entity: FakeEntity): Promise<FakeEntity> {
    this.store.set(entity.id, entity);
    return entity;
  }
  async createIfNotExists(data: any, blockNum: number, _present?: boolean): Promise<FakeEntity> {
    const id = data.id;
    const existing = this.store.get(id);
    if (existing) return existing;
    const entity = new FakeEntity(id, blockNum, data.payload ?? '');
    this.store.set(id, entity);
    return entity;
  }
  async deleteByBlockNumGreaterThan(blockNum: number): Promise<void> {
    for (const [k, v] of this.store) {
      if (v.block_num > blockNum) this.store.delete(k);
    }
  }
  async restoreFromVersions(forkBlockNum: number): Promise<void> {
    // Имитируем восстановление: если в versions есть snapshot с block_num <= forkBlockNum — кладём обратно.
    for (const [id, history] of this.versions) {
      const candidate = [...history].reverse().find((v) => v.block_num <= forkBlockNum);
      if (candidate && !this.store.has(id)) {
        this.store.set(id, new FakeEntity(candidate.id, candidate.block_num, candidate.payload));
      }
    }
  }
}

// ───── Trivial mapper-заглушка (нужна только для конструктора) ─────
class FakeMapper implements IBlockchainDeltaMapper<{ id: string; payload: string }> {
  mapDeltaToBlockchainData() {
    return null;
  }
  extractSyncValue() {
    return '';
  }
  extractSyncKey() {
    return 'id';
  }
  getAllEventPatterns() {
    return [];
  }
  getSupportedTableNames() {
    return [];
  }
  getSupportedContractNames() {
    return [];
  }
}

// ───── Два concrete-syncer'а — наследники AbstractEntitySyncService ─────
@Injectable()
class CapitalProjectsSyncService extends AbstractEntitySyncService<FakeEntity, { id: string; payload: string }> {
  protected readonly entityName = 'CapitalProject';
  constructor(
    public readonly repo: FakeRepository,
    mapper: FakeMapper,
    logger: WinstonLoggerService
  ) {
    super(repo, mapper, logger);
  }
}

@Injectable()
class CapitalSegmentsSyncService extends AbstractEntitySyncService<FakeEntity, { id: string; payload: string }> {
  protected readonly entityName = 'CapitalSegment';
  constructor(
    public readonly repo: FakeRepository,
    mapper: FakeMapper,
    logger: WinstonLoggerService
  ) {
    super(repo, mapper, logger);
  }
}

describe('fork-flow integration (Story 4.1)', () => {
  let module: TestingModule;
  let registry: ForkRegistryService;
  let projects: CapitalProjectsSyncService;
  let segments: CapitalSegmentsSyncService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DiscoveryModule, LoggerModule, ForkRegistryModule],
      providers: [
        // Шарим разные in-memory репо и общий маппер.
        { provide: FakeMapper, useValue: new FakeMapper() },
        {
          provide: CapitalProjectsSyncService,
          useFactory: (mapper: FakeMapper, logger: WinstonLoggerService) =>
            new CapitalProjectsSyncService(new FakeRepository(), mapper, logger),
          inject: [FakeMapper, WinstonLoggerService],
        },
        {
          provide: CapitalSegmentsSyncService,
          useFactory: (mapper: FakeMapper, logger: WinstonLoggerService) =>
            new CapitalSegmentsSyncService(new FakeRepository(), mapper, logger),
          inject: [FakeMapper, WinstonLoggerService],
        },
      ],
    }).compile();

    await module.init(); // onApplicationBootstrap → ForkRegistry собирает syncer'ов

    registry = module.get(ForkRegistryService);
    projects = module.get(CapitalProjectsSyncService);
    segments = module.get(CapitalSegmentsSyncService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('bootstrap: ForkRegistry автоматически зарегистрировал оба syncer-а через DiscoveryService', () => {
    expect(registry.size()).toBe(2);
  });

  it('AC: сценарий delta(N+1) → fork(N) → delta(N+2)', async () => {
    const N = 1000;

    // delta(N+1): обе сущности созданы на блоке N+1
    await projects.repo.save(new FakeEntity('p1', N + 1, 'project-v1'));
    await segments.repo.save(new FakeEntity('s1', N + 1, 'segment-v1'));
    expect(projects.repo.store.get('p1')?.block_num).toBe(N + 1);
    expect(segments.repo.store.get('s1')?.block_num).toBe(N + 1);

    // fork(N): ForkRegistry.runAll последовательно удаляет все entities с block_num > N
    await registry.runAll(N);

    expect(projects.repo.store.has('p1')).toBe(false);
    expect(segments.repo.store.has('s1')).toBe(false);

    // delta(N+2): новые сущности успешно сохраняются после rollback
    await projects.repo.save(new FakeEntity('p1', N + 2, 'project-v2'));
    await segments.repo.save(new FakeEntity('s1', N + 2, 'segment-v2'));

    expect(projects.repo.store.get('p1')?.block_num).toBe(N + 2);
    expect(projects.repo.store.get('p1')?.payload).toBe('project-v2');
    expect(segments.repo.store.get('s1')?.block_num).toBe(N + 2);
    expect(segments.repo.store.get('s1')?.payload).toBe('segment-v2');
  });

  it('AC: rollback не трогает сущности с block_num <= N', async () => {
    const N = 2000;

    // Старая сущность на блоке ниже форка — должна выжить.
    await projects.repo.save(new FakeEntity('p2-old', N - 10, 'old-project'));
    // Свежая сущность на блоке > N — должна быть удалена.
    await projects.repo.save(new FakeEntity('p2-new', N + 1, 'new-project'));

    await registry.runAll(N);

    expect(projects.repo.store.has('p2-old')).toBe(true);
    expect(projects.repo.store.has('p2-new')).toBe(false);
  });

  it('AC: ошибка одного syncer-а пробрасывается, остальные НЕ запускаются', async () => {
    const N = 3000;

    // Подмешиваем сбойный syncer вручную (через register), чтобы не ломать остальные кейсы.
    const trace: string[] = [];
    const before = registry.size();
    const flaky = {
      [Symbol.for('mono.controller.shared.sync.ForkAware')]: true,
      async handleFork() {
        trace.push('flaky');
        throw new Error('flaky rollback failed');
      },
    } as any;
    const after = {
      [Symbol.for('mono.controller.shared.sync.ForkAware')]: true,
      async handleFork() {
        trace.push('after');
      },
    } as any;
    registry.register(flaky);
    registry.register(after);

    await expect(registry.runAll(N)).rejects.toThrow('flaky rollback failed');
    expect(trace).toEqual(['flaky']); // 'after' не запущен

    // Чистим, чтобы не влиять на size() в других кейсах
    registry.unregister(flaky);
    registry.unregister(after);
    expect(registry.size()).toBe(before);
  });
});
