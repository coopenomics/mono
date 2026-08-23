/**
 * Границы проекта списания имущества.
 *
 * Списание — выбытие имущества кооператива, поэтому оно единственное в столе
 * идёт через совет: председатель только готовит проект, решение принимает
 * совет протоколом, а фактическое выбытие подтверждает председатель того
 * участка, на складе которого имущество лежит.
 *
 * Здесь проверяются отказы, которые обязаны сработать до любого движения:
 * состав проекта (причина, наименование, участок, сумма), чужой участок при
 * подтверждении и попытка провести списание в обход совета.
 */
import { BadRequestException } from '@nestjs/common';

import { MarketplaceWriteoffService } from '~/extensions/marketplace/application/services/marketplace-writeoff.service';

const COOP = 'voskhod';
const BRANCH = 'krg';

function makeService() {
  const repo = {
    findOpenDraft: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    findByHash: jest.fn(),
    create: jest.fn(),
    updateDraftItems: jest.fn(),
    markItemExecuted: jest.fn(),
    markFullyExecuted: jest.fn(),
    markExecuting: jest.fn(),
    findActiveLockedInventoryIds: jest.fn().mockResolvedValue([]),
  };
  const inventoryRepo = {
    findWriteoffCandidates: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    applyStatusTransition: jest.fn(),
  };
  const chainPort = { confirmWroff: jest.fn(), propWroff: jest.fn(), execWroff: jest.fn() };
  const service = new MarketplaceWriteoffService(
    repo as never,
    inventoryRepo as never,
    // Оффер нужен сервису за единицей отпуска и размером упаковки; в границах
    // этого файла до него не доходит — валидация отбивает раньше.
    { findById: jest.fn() } as never,
    chainPort as never,
    { symbol: 'RUB', decimals: 4 } as never,
    { generateDocument: jest.fn(), buildDocumentAggregate: jest.fn() } as never,
    { buildDisplay: jest.fn() } as never,
    { emit: jest.fn() } as never,
    { setContext: jest.fn(), log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never
  );
  return { service, repo, inventoryRepo, chainPort };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    braname: BRANCH,
    asset_title: 'Берёзовый сок',
    quantity: 3,
    amount: '150.0000',
    reason: 'Истёк срок годности',
    inventory_ids: ['inv-1'],
    ...overrides,
  };
}

function draftInput(items: unknown[]) {
  return {
    coopname: COOP,
    trigger: 'manual',
    proposed_by_account: 'ant',
    items,
  } as never;
}

describe('MarketplaceWriteoffService: состав проекта списания', () => {
  it('позиция без причины → отказ с указанием наименования', async () => {
    const { service, repo } = makeService();

    // Причину backend не угадывает и не подставляет по умолчанию: она уходит
    // в Заявление и Служебную записку как заявленная человеком.
    await expect(
      service.createDraft(draftInput([item({ reason: '   ' })]))
    ).rejects.toThrow('Не указана причина списания позиции "Берёзовый сок"');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('пустой список позиций → отказ', async () => {
    const { service, repo } = makeService();

    await expect(service.createDraft(draftInput([]))).rejects.toThrow(
      'Список позиций к списанию пуст'
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('позиция без участка или без наименования → отказ', async () => {
    const { service, repo } = makeService();

    await expect(
      service.createDraft(draftInput([item({ braname: '' })]))
    ).rejects.toThrow('Не указан КУ позиции');
    await expect(
      service.createDraft(draftInput([item({ asset_title: '' })]))
    ).rejects.toThrow('Не указано наименование позиции');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('неположительная или нечисловая сумма позиции → отказ', async () => {
    const { service, repo } = makeService();

    await expect(service.createDraft(draftInput([item({ amount: '0' })]))).rejects.toThrow(
      'Некорректная сумма позиции'
    );
    await expect(service.createDraft(draftInput([item({ amount: '-5' })]))).rejects.toThrow(
      'Некорректная сумма позиции'
    );
    await expect(service.createDraft(draftInput([item({ amount: 'много' })]))).rejects.toThrow(
      'Некорректная сумма позиции'
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('больше двухсот позиций → отказ, ровно двести проходят границу', async () => {
    const { service } = makeService();

    await expect(
      service.createDraft(draftInput(Array.from({ length: 201 }, () => item())))
    ).rejects.toThrow('Максимум 200 позиций');

    const atBoundary = await service
      .createDraft(draftInput(Array.from({ length: 200 }, () => item())))
      .then(() => null)
      .catch((e: Error) => e);
    expect(atBoundary?.message ?? '').not.toContain('Максимум 200 позиций');
  });
});

describe('MarketplaceWriteoffService.confirmWriteoff: кто и когда проводит списание', () => {
  const pendingProposal = (overrides: Record<string, unknown> = {}) => ({
    id: 'proposal-1',
    coopname: COOP,
    proposal_hash: 'b'.repeat(64),
    status: 'PENDING_CONFIRMATION',
    is_pending_confirmation: true,
    items: [{ braname: BRANCH, asset_title: 'Берёзовый сок', executed: false, inventory_ids: ['inv-1'] }],
    ...overrides,
  });

  const confirmInput = (overrides: Record<string, unknown> = {}) => ({
    id: 'proposal-1',
    coopname: COOP,
    chairman_account: 'chairkrg',
    braname: BRANCH,
    signed_memo: { meta: {}, signatures: [] },
    ...overrides,
  }) as never;

  it('проект ещё не утверждён советом → провести списание нельзя', async () => {
    const { service, repo, chainPort, inventoryRepo } = makeService();
    repo.findById.mockResolvedValue(
      pendingProposal({ status: 'ON_AGENDA', is_pending_confirmation: false })
    );

    // Сообщение обязано называть текущий статус: без него председатель не
    // поймёт, чего ждать — решения совета или подписи соседнего участка.
    await expect(service.confirmWriteoff(confirmInput())).rejects.toThrow(
      'ожидающему подтверждения складов (текущий: ON_AGENDA)'
    );
    // Ни цепь, ни склад не тронуты.
    expect(chainPort.confirmWroff).not.toHaveBeenCalled();
    expect(inventoryRepo.applyStatusTransition).not.toHaveBeenCalled();
  });

  it('председатель чужого участка → подтверждать нечего', async () => {
    const { service, repo, chainPort, inventoryRepo } = makeService();
    repo.findById.mockResolvedValue(pendingProposal());

    // Проект касается склада krg; председатель odn своих позиций в нём не
    // имеет и подтвердить чужое выбытие не может.
    await expect(
      service.confirmWriteoff(confirmInput({ braname: 'odn', chairman_account: 'chairodn' }))
    ).rejects.toThrow('нет неподтверждённых позиций кооперативного участка odn');
    expect(chainPort.confirmWroff).not.toHaveBeenCalled();
    expect(inventoryRepo.applyStatusTransition).not.toHaveBeenCalled();
  });

  it('позиции участка уже подтверждены → повторное подтверждение отбивается', async () => {
    const { service, repo, chainPort } = makeService();
    repo.findById.mockResolvedValue(
      pendingProposal({
        items: [{ braname: BRANCH, asset_title: 'Берёзовый сок', executed: true, inventory_ids: ['inv-1'] }],
      })
    );

    await expect(service.confirmWriteoff(confirmInput())).rejects.toThrow(
      `нет неподтверждённых позиций кооперативного участка ${BRANCH}`
    );
    expect(chainPort.confirmWroff).not.toHaveBeenCalled();
  });
});

describe('MarketplaceWriteoffService.executeAuthorizedProposal: без решения совета', () => {
  it('исполнение проекта, который совет не утверждал → отказ', async () => {
    const { service, repo } = makeService();
    repo.findById.mockResolvedValue({
      id: 'proposal-1',
      coopname: COOP,
      status: 'DRAFT',
      is_authorized: false,
      is_executing: false,
      items: [],
    });

    await expect(service.executeAuthorizedProposal('proposal-1', 'ant')).rejects.toThrow(
      BadRequestException
    );
    await expect(service.executeAuthorizedProposal('proposal-1', 'ant')).rejects.toThrow(
      'только из AUTHORIZED/EXECUTING (текущий: DRAFT)'
    );
    expect(repo.markExecuting).not.toHaveBeenCalled();
  });
});
