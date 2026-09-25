/**
 * Участник Благороста: строка в базе и дельта своего же блока.
 *
 * С 23.09.2026 transact возвращается, когда блок уже разобран: дельта участника
 * приходит раньше, чем управление вернётся в интерактор. Импорт и регистрация
 * создавали строку ПОСЛЕ транзакции — синхронизатор к тому моменту уже пытался
 * завести участника сам, без имени (колонка обязательная), и данные цепи в
 * зеркало не доходили никогда (нашёл внешний слой, 25.09.2026, C28-80).
 */
import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { ParticipationManagementInteractor } from '~/extensions/capital/application/use-cases/participation-management.interactor';
import { ContributorSyncService } from '~/extensions/capital/application/syncers/contributor-sync.service';
import { ContributorDomainEntity } from '~/extensions/capital/domain/entities/contributor.entity';
import { ContributorStatus } from '~/extensions/capital/domain/enums/contributor-status.enum';

configurePlatformSettings({
  coopname: 'voskhod',
  blockchain: { rootGovernSymbol: 'RUB', rootGovernPrecision: 4 },
} as any);

const tx = { transaction_id: 'tx-1', processed: { block_num: 42 } };

function build() {
  const calls: string[] = [];
  const contributorRepository = {
    findByUsername: jest.fn(async (): Promise<any> => null),
    findOne: jest.fn(async (): Promise<any> => null),
    create: jest.fn(async (c: any) => {
      calls.push('create');
      return Object.assign(Object.create(Object.getPrototypeOf(c)), c, { _id: 'row-1' });
    }),
    update: jest.fn(async (c: any) => c),
    delete: jest.fn(async () => {
      calls.push('delete');
    }),
  };
  const chain = {
    importContributor: jest.fn(async () => {
      calls.push('chain');
      return tx;
    }),
    registerContributor: jest.fn(async () => {
      calls.push('chain');
      return tx;
    }),
    registerContributorWithAgreements: jest.fn(async () => {
      calls.push('chain');
      return tx;
    }),
    getContributor: jest.fn(),
  };
  const accountPort = { getDisplayName: jest.fn(async () => 'Иванов Иван') };
  const documentPort = {
    getByHash: jest.fn(async (hash: string) => ({ meta: { username: 'ivanov', contributor_hash: 'abc' }, hash })),
  };
  const candidates = { findByUsername: jest.fn(async () => null) };
  const udata = {
    saveContributorContractParameters: jest.fn(async () => undefined),
    saveBlagorostAgreementParameters: jest.fn(async () => undefined),
  };
  const utils = {
    convertSignedDocumentToBlockchainFormat: jest.fn((d: any) => d),
    formatNumericStringToAssetString: jest.fn(() => '0.0000 RUB'),
  };
  const interactor = new ParticipationManagementInteractor(
    chain as any,
    contributorRepository as any,
    {} as any,
    accountPort as any,
    candidates as any,
    udata as any,
    {} as any,
    utils as any,
    documentPort as any,
    {} as any
  );
  return { interactor, contributorRepository, chain, calls };
}

const importInput = {
  coopname: 'voskhod',
  username: 'ivanov',
  contribution_amount: '1500.0000 RUB',
  contributor_contract_number: '1',
  contributor_contract_created_at: '01.09.2026',
  blagorost_agreement_number: '1',
  blagorost_agreement_created_at: '01.09.2026',
};

const doc = (doc_hash: string) => ({ doc_hash, hash: doc_hash, meta_hash: 'm', meta: {}, signatures: [], version: '1' });

describe('участник Благороста — строка до транзакции', () => {
  it('импорт: строка с именем создаётся до отправки в цепь', async () => {
    const m = build();
    await m.interactor.importContributor(importInput as any);

    expect(m.calls).toEqual(['create', 'chain']);
    expect(m.contributorRepository.create.mock.calls[0][0].display_name).toBe('Иванов Иван');
  });

  it('импорт: цепь отказала — строка удалена, отказ передан наверх', async () => {
    const m = build();
    m.chain.importContributor.mockRejectedValueOnce(new Error('assertion failure'));

    await expect(m.interactor.importContributor(importInput as any)).rejects.toThrow('assertion failure');
    expect(m.calls).toEqual(['create', 'delete']);
    expect(m.contributorRepository.delete).toHaveBeenCalledWith('row-1');
  });

  it('импорт участника, уже заведённого в реестре контроллера, — отказ до обращения к цепи', async () => {
    const m = build();
    m.contributorRepository.findByUsername.mockResolvedValueOnce({ username: 'ivanov' });

    await expect(m.interactor.importContributor(importInput as any)).rejects.toMatchObject({
      code: 'CAPITAL_CONTRIBUTOR_ALREADY_REGISTERED',
    });
    expect(m.calls).toEqual([]);
  });

  it('регистрация: строка до транзакции, данные цепи — из дельты, без чтения цепи после', async () => {
    const m = build();
    await m.interactor.registerContributor({
      coopname: 'voskhod',
      username: 'ivanov',
      contributor_hash: 'abc',
      contract: doc('contract'),
    } as any);

    expect(m.calls).toEqual(['create', 'chain']);
    expect(m.chain.getContributor).not.toHaveBeenCalled();
    const row = m.contributorRepository.create.mock.calls[0][0];
    expect(row.present).toBe(false);
    expect(row.status).toBe(ContributorStatus.PENDING);
  });

  it('завершение регистрации сохраняет строку, перечитанную после транзакции, а не объект до неё', async () => {
    const m = build();
    const before = new ContributorDomainEntity({
      _id: 'row-1',
      username: 'ivanov',
      coopname: 'voskhod',
      contributor_hash: 'abc',
      display_name: 'Иванов Иван',
      status: ContributorStatus.PENDING,
      present: false,
    } as any);
    const afterDelta = Object.assign(Object.create(ContributorDomainEntity.prototype), before, {
      present: true,
      block_num: 42,
      status: ContributorStatus.ACTIVE,
    });
    m.contributorRepository.findByUsername.mockResolvedValueOnce(before).mockResolvedValueOnce(afterDelta);

    await m.interactor.completeCapitalRegistration({
      coopname: 'voskhod',
      username: 'ivanov',
      storage_agreement: doc('storage'),
      about: 'Разработчик',
    } as any);

    const saved = m.contributorRepository.update.mock.calls[0][0];
    expect(saved.block_num).toBe(42);
    expect(saved.status).toBe(ContributorStatus.ACTIVE);
    expect(saved.storage_agreement_hash).toBe('storage');
    expect(saved.about).toBe('Разработчик');
  });
});

describe('участник, заведённый в цепи мимо контроллера', () => {
  it('синхронизатор создаёт строку и дописывает имя из аккаунта', async () => {
    const created = new ContributorDomainEntity({ _id: 'row-9', username: 'petrov', contributor_hash: 'def' } as any);
    const repository = {
      findBySyncKey: jest.fn(async (): Promise<any> => null),
      createIfNotExists: jest.fn(async () => created),
      update: jest.fn(async (c: any) => c),
    };
    const accountPort = { getDisplayName: jest.fn(async () => 'Петров Пётр') };
    const logger = { setContext: jest.fn(), debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const service = new ContributorSyncService(repository as any, {} as any, logger as any, {} as any, {} as any, accountPort as any);
    repository.findBySyncKey.mockResolvedValueOnce(null).mockResolvedValueOnce(created);

    const result = await service.handleSyncDelta('contributor_hash', 'def', { contributor_hash: 'def' } as any, 50);

    expect(result.created).toBe(true);
    expect(created.display_name).toBe('Петров Пётр');
    expect(repository.update).toHaveBeenCalledWith(created);
  });
});
