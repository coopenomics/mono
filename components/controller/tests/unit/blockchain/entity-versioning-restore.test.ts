/**
 * Unit-тесты EntityVersioningService.restoreVersionsAfterFork — возврат зеркал
 * к состоянию на блоке форка.
 *
 * Версия хранит состояние сущности ДО изменения и блок самого изменения.
 * Инварианты:
 * - сущность без изменений после форка остаётся как есть;
 * - сущность с изменениями после форка возвращается к состоянию перед ПЕРВЫМ
 *   из них;
 * - сущность, которой на блоке форка не было, не воссоздаётся;
 * - локальные изменения (блок не задан) форк не затрагивает.
 *
 * До 04.10.2026 восстановление брало версии с блоком не больше блока форка и
 * откатывало на шаг назад все записи с историей (C28-85): так у пайщика из
 * зеркала пропала подпись программной оферты после форка, который её не касался.
 */
import { EntityVersionRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';

interface Version {
  entity_table: string;
  entity_id: string;
  previous_data: Record<string, any>;
  block_num: number | null;
  created_at: Date;
}

const TABLE = 'user_agreements';

function version(entity_id: string, block_num: number | null, previous_data: Record<string, any>, order = 0): Version {
  return { entity_table: TABLE, entity_id, block_num, previous_data, created_at: new Date(1_000 + order) };
}

/** Хранилище версий с тем же договором, что у настоящего репозитория: изменения после блока форка, от ранних к поздним. */
function makeVersionStore(versions: Version[]) {
  return {
    getVersionsForRecovery: jest.fn(async (entityTable: string, forkBlockNum: number) =>
      versions
        .filter((v) => v.entity_table === entityTable && v.block_num !== null && v.block_num > forkBlockNum)
        .sort(
          (a, b) =>
            a.entity_id.localeCompare(b.entity_id) ||
            (a.block_num as number) - (b.block_num as number) ||
            a.created_at.getTime() - b.created_at.getTime()
        )
    ),
  };
}

/** Живая таблица зеркала: записи по `_id`. */
function makeLiveTable(rows: Record<string, any>[]) {
  const table = new Map<string, Record<string, any>>(rows.map((row) => [row._id, { ...row }]));
  return {
    table,
    repository: {
      findOne: jest.fn(async ({ where }: { where: { _id: string } }) => table.get(where._id) ?? null),
      create: jest.fn((data: Record<string, any>) => ({ ...data })),
      save: jest.fn(async (row: Record<string, any>) => {
        table.set(row._id, { ...row });
        return row;
      }),
    },
  };
}

function restore(versions: Version[], live: ReturnType<typeof makeLiveTable>, forkBlockNum: number) {
  const service = new EntityVersioningService(makeVersionStore(versions) as any, {} as any, {} as any);
  return service.restoreVersionsAfterFork(live.repository as any, TABLE, forkBlockNum);
}

const signedAt = (block_num: number, programs: number[]) => ({ _id: 'alice', username: 'alice', programs, block_num });

describe('EntityVersioningService.restoreVersionsAfterFork', () => {
  // sync.fork.side.01
  it('запись без изменений после форка остаётся как есть', async () => {
    // Пайщик подписал оферту на блоке 20; форк на блоке 25 его не касается.
    const live = makeLiveTable([signedAt(20, [1, 2])]);
    await restore([version('alice', 20, signedAt(10, [1]))], live, 25);

    expect(live.repository.save).not.toHaveBeenCalled();
    expect(live.table.get('alice')).toEqual(signedAt(20, [1, 2]));
  });

  // sync.fork.happy.01
  it('запись с изменениями после форка возвращается к состоянию перед первым из них', async () => {
    // Живую запись блока 40 архив уже убрал — восстановление создаёт её заново.
    const live = makeLiveTable([]);
    await restore(
      [
        version('alice', 20, signedAt(10, [1])),
        version('alice', 30, signedAt(20, [1, 2])),
        version('alice', 40, signedAt(30, [1, 2, 3])),
      ],
      live,
      25
    );

    expect(live.table.get('alice')).toEqual(signedAt(20, [1, 2]));
  });

  // sync.fork.side.02
  it('несколько изменений в одном блоке после форка: берётся самое раннее', async () => {
    const live = makeLiveTable([]);
    await restore(
      [version('alice', 30, signedAt(30, [1, 2, 3]), 2), version('alice', 30, signedAt(20, [1, 2]), 1)],
      live,
      25
    );

    expect(live.table.get('alice')).toEqual(signedAt(20, [1, 2]));
  });

  // sync.fork.side.03
  it('запись, которой на блоке форка не было, не воссоздаётся', async () => {
    // Появилась на блоке 30, изменилась на блоке 40; форк на блоке 25.
    const live = makeLiveTable([]);
    await restore([version('alice', 40, signedAt(30, [1]))], live, 25);

    expect(live.repository.save).not.toHaveBeenCalled();
    expect(live.table.has('alice')).toBe(false);
  });

  // sync.fork.side.04
  it('локальное изменение без блока форк не откатывает', async () => {
    const live = makeLiveTable([signedAt(20, [1, 2])]);
    await restore([version('alice', null, signedAt(20, [1]))], live, 25);

    expect(live.repository.save).not.toHaveBeenCalled();
    expect(live.table.get('alice')).toEqual(signedAt(20, [1, 2]));
  });

  // sync.fork.side.05
  it('из нескольких записей возвращается только та, что менялась после форка', async () => {
    const bob = (block_num: number, programs: number[]) => ({ _id: 'bob', username: 'bob', programs, block_num });
    const live = makeLiveTable([signedAt(20, [1, 2])]);
    await restore(
      [version('alice', 20, signedAt(10, [1])), version('bob', 15, bob(5, [])), version('bob', 30, bob(15, [1]))],
      live,
      25
    );

    expect(live.table.get('alice')).toEqual(signedAt(20, [1, 2]));
    expect(live.table.get('bob')).toEqual(bob(15, [1]));
    expect(live.repository.save).toHaveBeenCalledTimes(1);
  });

  // sync.fork.side.06
  it('живая запись на месте: возвращается к состоянию на блоке форка, а не создаётся второй раз', async () => {
    const live = makeLiveTable([signedAt(30, [1, 2, 3])]);
    await restore([version('alice', 30, signedAt(20, [1, 2]))], live, 25);

    expect(live.repository.create).not.toHaveBeenCalled();
    expect(live.table.get('alice')).toEqual(signedAt(20, [1, 2]));
  });
});

describe('EntityVersionRepository.getVersionsForRecovery', () => {
  // sync.fork.side.07
  it('выбирает изменения ПОСЛЕ блока форка, от ранних к поздним', async () => {
    const calls: Array<[string, unknown[]]> = [];
    const builder: Record<string, any> = { getMany: jest.fn(async () => []) };
    for (const link of ['where', 'andWhere', 'orderBy', 'addOrderBy']) {
      builder[link] = jest.fn((...args: unknown[]) => {
        calls.push([link, args]);
        return builder;
      });
    }
    const repository = new EntityVersionRepository({ createQueryBuilder: jest.fn(() => builder) } as any);

    await repository.getVersionsForRecovery(TABLE, 25);

    expect(calls).toContainEqual(['andWhere', ['version.block_num > :forkBlockNum', { forkBlockNum: 25 }]]);
    expect(calls).toContainEqual(['addOrderBy', ['version.block_num', 'ASC']]);
    expect(calls).toContainEqual(['addOrderBy', ['version.created_at', 'ASC']]);
    // Условие «блок не больше блока форка» и было дефектом.
    expect(JSON.stringify(calls)).not.toContain('<=');
  });
});
