/**
 * Unit-тесты BaseBlockchainRepository.createIfNotExists (Story 1.1, DEC-008).
 *
 * Фокус — guard монотонности block_num на create-пути: устаревшая дельта
 * (из более раннего блока) не должна затирать более свежую запись, иначе
 * состояние в БД откатывается назад при гонке дельт.
 */

import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';

function makeDomain(data: any) {
  return {
    _id: data._id ?? 'id-1',
    block_num: data.block_num,
    present: data.present ?? true,
    getBlockNum: () => data.block_num,
    getPrimaryKey: () => String(data.username ?? 'pk'),
    getSyncKey: () => 'username',
    updateFromBlockchain: jest.fn(),
  };
}

/** Конкретный наследник абстрактного репозитория для теста. */
class TestRepo extends BaseBlockchainRepository<any, any> {
  constructor(repo: any, versioning: any) {
    super(repo, versioning);
  }
  protected getMapper() {
    return {
      toDomain: (e: any) => (e && e.getBlockNum ? e : makeDomain(e)),
      toEntity: (d: any) => ({ ...d }),
    };
  }
  protected createDomainEntity(databaseData: any, blockchainData: any) {
    return makeDomain({ ...databaseData, ...blockchainData });
  }
  protected getSyncKey() {
    return 'username';
  }
}

function makeRepoStub(existingDomain: any) {
  return {
    target: { getTableName: () => 'test_table' },
    findOne: jest.fn(async () => existingDomain),
    save: jest.fn(async (e: any) => e),
  } as any;
}

function makeVersioningStub() {
  return { saveVersionBeforeUpdate: jest.fn(async () => undefined) } as any;
}

describe('BaseBlockchainRepository.createIfNotExists — guard block_num (Story 1.1)', () => {
  it('не перезаписывает свежую запись устаревшей дельтой (block_num < N)', async () => {
    const existing = makeDomain({ username: 'alice', block_num: 100 });
    const repoStub = makeRepoStub(existing);
    const repo = new TestRepo(repoStub, makeVersioningStub());

    const result = await repo.createIfNotExists({ username: 'Alice' }, /* blockNum */ 50, true);

    expect(result).toBe(existing);
    expect(existing.updateFromBlockchain).not.toHaveBeenCalled();
    expect(repoStub.save).not.toHaveBeenCalled();
  });

  it('обновляет запись более свежей дельтой (block_num > N)', async () => {
    const existing = makeDomain({ username: 'alice', block_num: 100 });
    const repoStub = makeRepoStub(existing);
    const repo = new TestRepo(repoStub, makeVersioningStub());

    await repo.createIfNotExists({ username: 'Alice' }, 150, true);

    expect(existing.updateFromBlockchain).toHaveBeenCalledWith({ username: 'Alice' }, 150, true);
    expect(repoStub.save).toHaveBeenCalled();
  });

  it('обновляет при равном block_num (идемпотентный повтор, не stale)', async () => {
    const existing = makeDomain({ username: 'alice', block_num: 100 });
    const repoStub = makeRepoStub(existing);
    const repo = new TestRepo(repoStub, makeVersioningStub());

    await repo.createIfNotExists({ username: 'Alice' }, 100, true);

    expect(existing.updateFromBlockchain).toHaveBeenCalled();
  });

  it('создаёт новую сущность, если записи ещё нет', async () => {
    const repoStub = makeRepoStub(null);
    const repo = new TestRepo(repoStub, makeVersioningStub());

    const result = await repo.createIfNotExists({ username: 'Bob' }, 10, true);

    expect(result).toBeTruthy();
    expect(repoStub.save).toHaveBeenCalled();
  });

  it('сравнивает block_num численно, когда из PG он пришёл строкой (bigint-as-string)', async () => {
    const existing = makeDomain({ username: 'alice', block_num: '100' as any });
    const repoStub = makeRepoStub(existing);
    const repo = new TestRepo(repoStub, makeVersioningStub());

    // '100' (строка) vs 50 (число): без Number() сравнение строк дало бы '100' < 50 == false по-разному;
    // guard обязан трактовать 50 < 100 как stale.
    const result = await repo.createIfNotExists({ username: 'Alice' }, 50, true);

    expect(result).toBe(existing);
    expect(existing.updateFromBlockchain).not.toHaveBeenCalled();
  });
});
