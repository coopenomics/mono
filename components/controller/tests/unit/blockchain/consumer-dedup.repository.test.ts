/**
 * Unit-тесты TypeOrmConsumerDedupRepository (Story 2.1).
 *
 * Фокус — контракт идемпотентности: isApplied отражает наличие метки,
 * markApplied вставляет с ON CONFLICT DO NOTHING (повтор не падает).
 */

import { TypeOrmConsumerDedupRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-consumer-dedup.repository';

function makeQueryBuilderStub() {
  const execute = jest.fn(async () => ({ affected: 1 }));
  const qb: any = {
    insert: jest.fn(() => qb),
    into: jest.fn(() => qb),
    values: jest.fn(() => qb),
    orIgnore: jest.fn(() => qb),
    delete: jest.fn(() => qb),
    from: jest.fn(() => qb),
    where: jest.fn(() => qb),
    execute,
  };
  return qb;
}

describe('TypeOrmConsumerDedupRepository (Story 2.1)', () => {
  it('isApplied → true, когда метка найдена', async () => {
    const repoStub: any = { findOne: jest.fn(async () => ({ event_id: 'e1' })) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);
    expect(await repo.isApplied('e1')).toBe(true);
  });

  it('isApplied → false, когда метки нет', async () => {
    const repoStub: any = { findOne: jest.fn(async () => null) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);
    expect(await repo.isApplied('e1')).toBe(false);
  });

  it('markApplied без blockNum пишет block_num=null (legacy-вызов)', async () => {
    const qb = makeQueryBuilderStub();
    const repoStub: any = { createQueryBuilder: jest.fn(() => qb) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);

    await repo.markApplied('e1');

    expect(qb.values).toHaveBeenCalledWith({ event_id: 'e1', block_num: null });
    expect(qb.orIgnore).toHaveBeenCalled();
    expect(qb.execute).toHaveBeenCalled();
  });

  it('markApplied с blockNum пишет block_num как строку (Story 4.1, bigint serialization)', async () => {
    const qb = makeQueryBuilderStub();
    const repoStub: any = { createQueryBuilder: jest.fn(() => qb) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);

    await repo.markApplied('e1', 12345);

    expect(qb.values).toHaveBeenCalledWith({ event_id: 'e1', block_num: '12345' });
  });

  it('deleteOlderThan возвращает число удалённых строк', async () => {
    const qb = makeQueryBuilderStub();
    qb.execute.mockResolvedValueOnce({ affected: 7 });
    const repoStub: any = { createQueryBuilder: jest.fn(() => qb) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);

    expect(await repo.deleteOlderThan(new Date())).toBe(7);
  });

  it('deleteAfterBlock (Story 4.1) выполняет DELETE WHERE block_num > N и возвращает число удалённых', async () => {
    const qb = makeQueryBuilderStub();
    qb.execute.mockResolvedValueOnce({ affected: 3 });
    const repoStub: any = { createQueryBuilder: jest.fn(() => qb) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);

    const purged = await repo.deleteAfterBlock(1000);

    expect(qb.delete).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith('block_num > :blockNum', { blockNum: 1000 });
    expect(purged).toBe(3);
  });

  it('deleteAfterBlock возвращает 0 при пустом результате', async () => {
    const qb = makeQueryBuilderStub();
    qb.execute.mockResolvedValueOnce({ affected: 0 });
    const repoStub: any = { createQueryBuilder: jest.fn(() => qb) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);

    expect(await repo.deleteAfterBlock(999)).toBe(0);
  });

  it('deleteAfterBlock возвращает 0, если драйвер не вернул affected', async () => {
    const qb = makeQueryBuilderStub();
    qb.execute.mockResolvedValueOnce({});
    const repoStub: any = { createQueryBuilder: jest.fn(() => qb) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);

    expect(await repo.deleteAfterBlock(999)).toBe(0);
  });
});
