/**
 * Базовое хранилище зеркала цепи на Kysely (C28-81): создание из дельты и
 * запись с версиями.
 *
 * Устаревшая дельта (из более раннего блока) не затирает более свежую запись —
 * иначе состояние в базе откатывается назад при гонке дельт. Перед изменением
 * существующей записи её прежнее состояние уходит в версии: без этого откат
 * форка нечем восстановить.
 */
import { BaseChainRepository } from '@coopenomics/extension-kit/sync';

function makeDomain(data: any) {
  return {
    _id: data._id,
    block_num: data.block_num,
    present: data.present ?? true,
    username: data.username,
    getBlockNum: () => data.block_num,
    updateFromBlockchain: jest.fn(),
  };
}

class TestRepository extends BaseChainRepository<any, any> {
  constructor(store: any, versioning: any) {
    super(store, versioning);
  }
  protected getMapper() {
    return {
      toDomain: (record: any) => (record && record.getBlockNum ? record : makeDomain(record)),
      toEntity: (domain: any) => ({ _id: domain._id, block_num: domain.block_num, present: domain.present, username: domain.username }),
    };
  }
  protected createDomainEntity(databaseData: any, blockchainData: any) {
    return makeDomain({ ...databaseData, ...blockchainData });
  }
  protected getSyncKey() {
    return 'username';
  }
}

function setup(existing: any | null) {
  const store = {
    table: 'mirror',
    findOne: jest.fn(async () => existing),
    save: jest.fn(async (record: any) => ({ _id: 'db-1', ...record })),
  };
  const versioning = { saveVersionBeforeUpdate: jest.fn(async () => undefined) };
  return { repository: new TestRepository(store, versioning), store, versioning };
}

describe('BaseChainRepository.createIfNotExists', () => {
  it('новая запись: ключ выдаёт база, версии не пишутся', async () => {
    const { repository, store, versioning } = setup(null);

    await repository.createIfNotExists({ username: 'ANT' }, 100);

    expect(store.findOne).toHaveBeenCalledWith({ username: 'ant' });
    expect(store.save.mock.calls[0][0]).not.toHaveProperty('_id');
    expect(store.save.mock.calls[0][0]).toMatchObject({ block_num: 100, username: 'ant' });
    expect(versioning.saveVersionBeforeUpdate).not.toHaveBeenCalled();
  });

  it('устаревшая дельта не затирает более свежую запись', async () => {
    const { repository, store } = setup({ _id: 'db-1', block_num: 200, username: 'ant' });

    await repository.createIfNotExists({ username: 'ant' }, 150);

    expect(store.save).not.toHaveBeenCalled();
  });

  it('блок из базы строкой сравнивается числом, а не по алфавиту', async () => {
    const { repository, store } = setup({ _id: 'db-1', block_num: '99', username: 'ant' });

    await repository.createIfNotExists({ username: 'ant' }, 100);

    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it('свежая дельта обновляет запись, прежнее состояние перед этим уходит в версии', async () => {
    const { repository, store, versioning } = setup({ _id: 'db-1', block_num: 100, username: 'ant' });

    await repository.createIfNotExists({ username: 'ant' }, 120);

    expect(versioning.saveVersionBeforeUpdate).toHaveBeenCalledWith(store, expect.objectContaining({ _id: 'db-1' }), 100, 'save');
    expect(store.save).toHaveBeenCalledTimes(1);
  });
});
