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

  it('markApplied вставляет с orIgnore (ON CONFLICT DO NOTHING)', async () => {
    const qb = makeQueryBuilderStub();
    const repoStub: any = { createQueryBuilder: jest.fn(() => qb) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);

    await repo.markApplied('e1');

    expect(qb.values).toHaveBeenCalledWith({ event_id: 'e1' });
    expect(qb.orIgnore).toHaveBeenCalled();
    expect(qb.execute).toHaveBeenCalled();
  });

  it('deleteOlderThan возвращает число удалённых строк', async () => {
    const qb = makeQueryBuilderStub();
    qb.execute.mockResolvedValueOnce({ affected: 7 });
    const repoStub: any = { createQueryBuilder: jest.fn(() => qb) };
    const repo = new TypeOrmConsumerDedupRepository(repoStub);

    expect(await repo.deleteOlderThan(new Date())).toBe(7);
  });
});
