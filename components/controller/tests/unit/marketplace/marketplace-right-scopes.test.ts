/**
 * Охваты прав Стола заказов сверяет общий гард (C28-87, случаи mkt.scopes.* в test-registry/marketplace.rights-table.yaml).
 *
 * Операция называет источник объекта третьим аргументом `@RequireRight`,
 * справочник объектов отдаёт владельца, участок и получателя, правило охвата
 * записано в каркасе расширений один раз. До 05.10.2026 каждую сверку писал
 * свой резолвер или сервис, с тридцатью семью разными кодами отказа.
 *
 * Требование каждой операции тест читает из исходника резолвера.
 */
import { memberOf, makeScopeGuard, requirementOf, type ScopeWorld } from './right-scope.harness';

const OWN = { code: 'KIT_RIGHT_SCOPE_OWN' };
const OWN_KU = { code: 'KIT_RIGHT_SCOPE_OWN_KU' };
const CHAIRED_KU = { code: 'KIT_RIGHT_SCOPE_CHAIRED_KU' };
const TO_SELF = { code: 'KIT_RIGHT_SCOPE_TO_SELF' };

/** Два участка: krg ведёт chairkrg с доверенным trustkrg, odn ведёт chairodn. */
const BRANCHES: ScopeWorld['branches'] = {
  krg: { trustee: 'chairkrg', trusted: ['trustkrg'] },
  odn: { trustee: 'chairodn' },
};

const chairKrg = memberOf('chairkrg', 'orderer', 'operator');
const trustKrg = memberOf('trustkrg', 'orderer', 'operator');
const chairOdn = memberOf('chairodn', 'orderer', 'operator');
const ivan = memberOf('ivan', 'orderer');
const petr = memberOf('petr', 'orderer');
const supplier = memberOf('sup1', 'orderer', 'offerer');
const otherSupplier = memberOf('sup2', 'orderer', 'offerer');
const chairman = memberOf('ant', 'orderer', 'admin');
const council = memberOf('sov', 'orderer', 'board_readonly');

const ORDER = { orderer_account: 'ivan', supplier_account: 'sup1', delivery_braname: 'krg', order_hash: 'h1' };

describe('свой участок: оператор работает с объектами своего участка', () => {
  const world: ScopeWorld = {
    branches: BRANCHES,
    objects: {
      Order: { o1: ORDER },
      Shipment: { s1: { offerer_account: 'sup1', braname: 'krg' } },
      Reception: { r1: { offerer_account: 'sup1', braname: 'krg' } },
      Inventory: { i1: { braname: 'krg' }, i2: { braname: 'odn' } },
      Container: { c1: { braname: 'krg' } },
      ContainerCode: { 'BX-1': { braname: 'krg' } },
      StorageCell: { cell1: { braname: 'krg' } },
      StockProposal: { p1: { member_account: 'ivan', braname: 'krg' } },
      ReturnClaim: { rc1: { orderer_account: 'ivan', delivery_braname: 'krg' } },
    },
  };
  const cases: [string, string, string, Record<string, unknown>][] = [
    ['акт приёмки по партии', 'marketplace-apl-reception.resolver.ts', 'marketplaceCreateAplReception', { data: { shipment_id: 's1' } }],
    ['закрывающая подпись акта', 'marketplace-apl-reception.resolver.ts', 'marketplaceSignAplReceptionAsChairman', { data: { apl_reception_id: 'r1' } }],
    ['лента приёмок участка', 'marketplace-apl-reception.resolver.ts', 'marketplaceListAplReceptionsByBraname', { data: { braname: 'krg' } }],
    ['маркировка позиции склада', 'marketplace-inventory.resolver.ts', 'marketplaceGenerateInventoryLabel', { data: { inventory_id: 'i1' } }],
    ['готовность выдачи по заказу', 'marketplace-issuance.resolver.ts', 'marketplaceReadyIssue', { data: { order_id: 'o1' } }],
    ['акт к закрытию выдачи', 'marketplace-issuance.resolver.ts', 'marketplaceIssuanceClosePayload', { data: { order_id: 'o1' } }],
    ['лента выдач участка', 'marketplace-issuance.resolver.ts', 'marketplaceListIssuancesByBraname', { data: { delivery_braname: 'krg' } }],
    ['реестр заказов участка', 'marketplace-order.resolver.ts', 'marketplaceListBranchOrders', { braname: 'krg' }],
    ['перестановка бокса', 'marketplace-container.resolver.ts', 'marketplaceMoveContainer', { data: { container_id: 'c1' } }],
    ['бокс по коду этикетки', 'marketplace-container.resolver.ts', 'marketplaceResolveContainerByCode', { data: { code: 'BX-1' } }],
    ['правка ячейки', 'marketplace-storage-cell.resolver.ts', 'marketplaceUpdateStorageCell', { data: { cell_id: 'cell1' } }],
    ['заведение ячейки', 'marketplace-storage-cell.resolver.ts', 'marketplaceCreateStorageCell', { data: { braname: 'krg' } }],
    ['публикация остатка', 'marketplace-stock.resolver.ts', 'marketplacePublishStock', { data: { inventory_ids: ['i1'] } }],
    ['отзыв предложения докладки', 'marketplace-stock.resolver.ts', 'marketplaceCancelStockProposal', { data: { proposal_id: 'p1' } }],
    ['отмена заказа со склада', 'marketplace-stock.resolver.ts', 'marketplaceCancelStockOrder', { data: { order_id: 'o1' } }],
    ['решение по возврату', 'marketplace-return-claim.resolver.ts', 'marketplaceApproveReturnVisit', { data: { braname: 'krg' } }],
    ['документы приёма возврата', 'marketplace-return-claim.resolver.ts', 'marketplaceReturnClaimChairmanSignablePayload', { claim_id: 'rc1' }],
    ['экономика участка', 'marketplace-economy.resolver.ts', 'marketplaceGetBranchEconomy', { braname: 'krg' }],
  ];

  // mkt.scopes.side.01
  it.each(cases)('%s: оператор чужого участка получает отказ по охвату', async (_title, file, operation, args) => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirementOf(file, operation), chairOdn, args)).rejects.toMatchObject(OWN_KU);
  });

  // mkt.scopes.happy.01
  it.each(cases)('%s: председатель и доверенный своего участка проходят', async (_title, file, operation, args) => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirementOf(file, operation), chairKrg, args)).resolves.toMatchObject({ scopes: ['own-KU'] });
    await expect(granted(requirementOf(file, operation), trustKrg, args)).resolves.toMatchObject({ scopes: ['own-KU'] });
  });

  // mkt.scopes.side.01
  it('публикация остатка: одна позиция чужого участка в списке закрывает всё действие', async () => {
    const { granted } = makeScopeGuard(world);
    const requirement = requirementOf('marketplace-stock.resolver.ts', 'marketplacePublishStock');
    await expect(granted(requirement, chairKrg, { data: { inventory_ids: ['i1', 'i2'] } })).rejects.toMatchObject(OWN_KU);
  });

  // mkt.scopes.happy.02
  it('председатель кооператива публикует остаток любого участка по праву на весь кооператив', async () => {
    const { granted, repos } = makeScopeGuard(world);
    const requirement = requirementOf('marketplace-stock.resolver.ts', 'marketplacePublishStock');
    await expect(granted(requirement, chairman, { data: { inventory_ids: ['i1', 'i2'] } })).resolves.toMatchObject({
      scopes: ['all'],
    });
    // Право на весь кооператив объект не читает.
    expect(repos.Inventory.findById).not.toHaveBeenCalled();
  });
});

describe('своё: владелец работает со своим объектом', () => {
  const world: ScopeWorld = {
    branches: BRANCHES,
    objects: {
      Order: { o1: ORDER },
      Offer: { f1: { supplier_account: 'sup1' } },
      Cycle: { cy1: { supplier_account: 'sup1' } },
      Shipment: { s1: { offerer_account: 'sup1', braname: 'krg' } },
      Reception: { r1: { offerer_account: 'sup1', braname: 'krg' } },
      StockProposal: { p1: { member_account: 'ivan', braname: 'krg' } },
    },
  };
  const cases: [string, string, string, Record<string, unknown>, typeof ivan, typeof ivan][] = [
    ['отмена заказа', 'marketplace-order.resolver.ts', 'marketplaceCancelOrder', { input: { order_id: 'o1' } }, ivan, petr],
    ['заявление на выдачу', 'marketplace-issuance.resolver.ts', 'marketplaceIssuanceStatementPayload', { data: { order_id: 'o1' } }, ivan, petr],
    ['первая подпись акта выдачи', 'marketplace-issuance.resolver.ts', 'marketplaceSignIssuanceAct', { data: { order_id: 'o1' } }, ivan, petr],
    ['заявление на возврат', 'marketplace-return-claim.resolver.ts', 'marketplaceCreateReturnClaim', { data: { order_id: 'o1' } }, ivan, petr],
    ['ответ на предложение докладки', 'marketplace-stock.resolver.ts', 'marketplaceDeclineStockProposal', { data: { proposal_id: 'p1' } }, ivan, petr],
    ['правка предложения', 'marketplace-offer.resolver.ts', 'marketplaceUpdateOffer', { input: { id: 'f1' } }, supplier, otherSupplier],
    ['снятие предложения', 'marketplace-offer.resolver.ts', 'marketplaceWithdrawOffer', { input: { id: 'f1' } }, supplier, otherSupplier],
    ['поставка по циклу', 'marketplace-shipment.resolver.ts', 'marketplaceCreateShipment', { data: { cycle_id: 'cy1' } }, supplier, otherSupplier],
    ['карточка поставки', 'marketplace-shipment.resolver.ts', 'marketplaceGetShipment', { data: { shipment_id: 's1' } }, supplier, otherSupplier],
    ['первая подпись акта приёмки', 'marketplace-apl-reception.resolver.ts', 'marketplaceSignAplReceptionAsSupplier', { data: { apl_reception_id: 'r1' } }, supplier, otherSupplier],
  ];

  // mkt.scopes.side.02
  it.each(cases)('%s: чужой объект закрыт отказом по охвату', async (_title, file, operation, args, _owner, stranger) => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirementOf(file, operation), stranger, args)).rejects.toMatchObject(OWN);
  });

  // mkt.scopes.happy.01
  it.each(cases)('%s: владелец проходит', async (_title, file, operation, args, owner) => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirementOf(file, operation), owner, args)).resolves.toMatchObject({ scopes: ['own'] });
  });

  // mkt.scopes.happy.01
  it('операции над своими данными объект не читают: корзина, свои заказы, свой кошелёк', async () => {
    const { granted, repos, kuChairmanService } = makeScopeGuard(world);
    for (const [file, operation] of [
      ['marketplace-cart.resolver.ts', 'marketplaceGetCart'],
      ['marketplace-order.resolver.ts', 'marketplaceListMyOrders'],
      ['marketplace-member-wallet.resolver.ts', 'marketplaceMemberWallet'],
    ]) {
      await expect(granted(requirementOf(file, operation), ivan)).resolves.toMatchObject({ scopes: ['own'] });
    }
    expect(repos.Order.findById).not.toHaveBeenCalled();
    expect(kuChairmanService.listBranamesForMember).not.toHaveBeenCalled();
  });
});

describe('адресовано мне: получатель работает с тем, что ему направлено', () => {
  const world: ScopeWorld = {
    branches: BRANCHES,
    objects: {
      Order: { o1: ORDER, o2: { ...ORDER, supplier_account: 'sup2' } },
      SupplierClaim: { sc1: { supplier_account: 'sup1' } },
    },
  };

  // mkt.scopes.side.03
  it('поставщик принимает и отклоняет только заказы, адресованные ему', async () => {
    const { granted } = makeScopeGuard(world);
    for (const operation of ['marketplaceAcceptOrdersBatch', 'marketplaceDeclineOrdersBatch']) {
      const requirement = requirementOf('marketplace-order.resolver.ts', operation);
      expect(requirement).toMatchObject({ resource: 'Order', action: 'respond:to-self' });
      await expect(granted(requirement, supplier, { input: { order_ids: ['o1'] } })).resolves.toMatchObject({
        scopes: ['to-self'],
      });
      await expect(granted(requirement, supplier, { input: { order_ids: ['o1', 'o2'] } })).rejects.toMatchObject(TO_SELF);
      await expect(granted(requirement, otherSupplier, { input: { order_ids: ['o1'] } })).rejects.toMatchObject(TO_SELF);
    }
  });

  // mkt.scopes.side.03
  it('претензию читает и признаёт поставщик, которому она выставлена; председатель читает любую', async () => {
    const { granted } = makeScopeGuard(world);
    const read = requirementOf('marketplace-supplier-claim.resolver.ts', 'marketplaceSupplierClaim');
    const admit = requirementOf('marketplace-supplier-claim.resolver.ts', 'marketplaceAdmitSupplierClaim');
    await expect(granted(read, supplier, { claim_id: 'sc1' })).resolves.toMatchObject({ scopes: ['to-self'] });
    await expect(granted(read, otherSupplier, { claim_id: 'sc1' })).rejects.toMatchObject(TO_SELF);
    await expect(granted(read, chairman, { claim_id: 'sc1' })).resolves.toMatchObject({ scopes: ['all'] });
    await expect(granted(admit, supplier, { data: { claim_id: 'sc1' } })).resolves.toMatchObject({ scopes: ['to-self'] });
    await expect(granted(admit, otherSupplier, { data: { claim_id: 'sc1' } })).rejects.toMatchObject(TO_SELF);
  });
});

describe('несколько охватов в одной операции', () => {
  const world: ScopeWorld = {
    branches: BRANCHES,
    objects: {
      Order: { o1: ORDER },
      Reception: { r1: { offerer_account: 'sup1', braname: 'krg' } },
      ReturnClaim: { rc1: { orderer_account: 'ivan', delivery_braname: 'krg' } },
      IssuanceSaga: { o1: { member_account: 'ivan', braname: 'krg' } },
    },
  };

  // mkt.scopes.side.04
  it('карточку заказа открывают заказчик, поставщик, участок получения и председатель — каждый по своему охвату', async () => {
    const { granted } = makeScopeGuard(world);
    const requirement = requirementOf('marketplace-order.resolver.ts', 'marketplaceGetOrder');
    const args = { input: { order_id: 'o1' } };
    await expect(granted(requirement, ivan, args)).resolves.toMatchObject({ scopes: ['own'] });
    await expect(granted(requirement, supplier, args)).resolves.toMatchObject({ scopes: ['to-self'] });
    await expect(granted(requirement, chairKrg, args)).resolves.toMatchObject({ scopes: ['own-KU'] });
    await expect(granted(requirement, chairman, args)).resolves.toMatchObject({ scopes: ['all'] });
    await expect(granted(requirement, council, args)).resolves.toMatchObject({ scopes: ['all'] });
  });

  // mkt.scopes.side.04
  it('посторонний пайщик, чужой поставщик и оператор другого участка карточку заказа не открывают', async () => {
    const { granted } = makeScopeGuard(world);
    const requirement = requirementOf('marketplace-order.resolver.ts', 'marketplaceGetOrder');
    const args = { input: { order_id: 'o1' } };
    await expect(granted(requirement, petr, args)).rejects.toMatchObject(OWN);
    await expect(granted(requirement, otherSupplier, args)).rejects.toMatchObject({ code: expect.stringMatching(/^KIT_RIGHT_SCOPE_/) });
    await expect(granted(requirement, chairOdn, args)).rejects.toMatchObject({ code: expect.stringMatching(/^KIT_RIGHT_SCOPE_/) });
  });

  // mkt.scopes.side.04
  it('акт приёмки отменяет его поставщик либо оператор участка акта', async () => {
    const { granted } = makeScopeGuard(world);
    const requirement = requirementOf('marketplace-apl-reception.resolver.ts', 'marketplaceCancelAplReception');
    const args = { data: { apl_reception_id: 'r1' } };
    await expect(granted(requirement, supplier, args)).resolves.toMatchObject({ scopes: ['own'] });
    await expect(granted(requirement, chairKrg, args)).resolves.toMatchObject({ scopes: ['own-KU'] });
    await expect(granted(requirement, otherSupplier, args)).rejects.toMatchObject(OWN);
    await expect(granted(requirement, chairOdn, args)).rejects.toMatchObject(OWN_KU);
  });

  // mkt.scopes.side.04
  it('ход выдачи и заявление на возврат читают заказчик и оператор участка, остальным отказ', async () => {
    const { granted } = makeScopeGuard(world);
    for (const [file, operation, args] of [
      ['marketplace-issuance.resolver.ts', 'marketplaceIssuanceSaga', { data: { order_id: 'o1' } }],
      ['marketplace-return-claim.resolver.ts', 'marketplaceReturnClaim', { claim_id: 'rc1' }],
    ] as const) {
      const requirement = requirementOf(file, operation);
      await expect(granted(requirement, ivan, args)).resolves.toMatchObject({ scopes: ['own'] });
      await expect(granted(requirement, trustKrg, args)).resolves.toMatchObject({ scopes: ['own-KU'] });
      await expect(granted(requirement, petr, args)).rejects.toMatchObject(OWN);
      await expect(granted(requirement, chairOdn, args)).rejects.toMatchObject({ code: expect.stringMatching(/^KIT_RIGHT_SCOPE_/) });
    }
  });
});

describe('участок, где я председатель', () => {
  const world: ScopeWorld = { branches: BRANCHES };

  // mkt.scopes.side.05
  it('распределение средств, веса доверенных и подачу расхода ведёт председатель участка; доверенному отказ', async () => {
    const { granted } = makeScopeGuard(world);
    for (const operation of [
      'marketplaceDistributeBranchFunds',
      'marketplaceSetTrusteeWeight',
      'marketplaceDeleteTrusteeWeight',
      'marketplaceCreateBranchExpense',
    ]) {
      const requirement = requirementOf('marketplace-economy.resolver.ts', operation);
      const args = { data: { braname: 'krg' } };
      await expect(granted(requirement, chairKrg, args)).resolves.toMatchObject({ scopes: ['chaired-KU'] });
      await expect(granted(requirement, trustKrg, args)).rejects.toMatchObject(CHAIRED_KU);
      await expect(granted(requirement, chairOdn, args)).rejects.toMatchObject(CHAIRED_KU);
    }
  });
});

describe('списание со склада участка', () => {
  const world: ScopeWorld = {
    branches: BRANCHES,
    objects: { WriteoffProposal: { w1: { items: [{ braname: 'krg' }, { braname: 'krg' }] } } },
  };
  /** Оператор участка odn, который входит в совет: право чтения всех списаний у него есть. */
  const councilOperator = memberOf('chairodn', 'orderer', 'operator', 'board_readonly');

  // mkt.scopes.side.06
  it('подтверждает списание оператор своего участка; право чтения всех списаний подтверждать чужой участок не даёт', async () => {
    const { granted } = makeScopeGuard(world);
    for (const operation of ['marketplaceConfirmWriteoff', 'marketplaceWriteoffServiceMemoSignablePayload']) {
      const requirement = requirementOf('marketplace-writeoff.resolver.ts', operation);
      const args = { data: { braname: 'krg' } };
      await expect(granted(requirement, chairKrg, args)).resolves.toMatchObject({ scopes: ['own-KU'] });
      await expect(granted(requirement, councilOperator, args)).rejects.toMatchObject(OWN_KU);
    }
  });

  // mkt.scope.side.07
  it('протокол совета читает оператор участка, чьи позиции есть в проекте списания', async () => {
    const { granted } = makeScopeGuard(world);
    const requirement = requirementOf('marketplace-writeoff.resolver.ts', 'marketplaceWriteoffProtocolDocument');
    const args = { data: { proposal_id: 'w1' } };
    await expect(granted(requirement, chairKrg, args)).resolves.toMatchObject({ scopes: ['own-KU'] });
    await expect(granted(requirement, chairOdn, args)).rejects.toMatchObject(OWN_KU);
  });
});

describe('списки: гард отдаёт операции участки отбора', () => {
  const world: ScopeWorld = {
    branches: { ...BRANCHES, msk: { trustee: 'chairkrg' } },
  };
  const lists: [string, string, (braname?: string) => Record<string, unknown>][] = [
    ['marketplace-inventory.resolver.ts', 'marketplaceListInventory', (braname) => ({ data: { braname } })],
    ['marketplace-container.resolver.ts', 'marketplaceListContainers', (braname) => ({ data: { braname } })],
    ['marketplace-storage-cell.resolver.ts', 'marketplaceListStorageCells', (braname) => ({ data: { braname } })],
    ['marketplace-stock.resolver.ts', 'marketplaceListStock', (braname) => ({ braname })],
  ];

  // mkt.scopes.happy.02
  it.each(lists)('%s %s: оператор получает свои участки, председатель — весь кооператив', async (file, operation, args) => {
    const { granted } = makeScopeGuard(world);
    const requirement = requirementOf(file, operation);
    await expect(granted(requirement, chairKrg, args())).resolves.toMatchObject({ kus: ['krg', 'msk'] });
    await expect(granted(requirement, chairKrg, args('msk'))).resolves.toMatchObject({ kus: ['msk'] });
    await expect(granted(requirement, chairman, args())).resolves.toMatchObject({ scopes: ['all'], kus: null });
    await expect(granted(requirement, chairman, args('odn'))).resolves.toMatchObject({ kus: ['odn'] });
  });

  // mkt.scopes.side.07
  it.each(lists)('%s %s: чужой участок в запросе закрыт отказом', async (file, operation, args) => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirementOf(file, operation), chairKrg, args('odn'))).rejects.toMatchObject(OWN_KU);
  });

  // mkt.scopes.happy.02
  it('ожидание подтверждения списаний: совет видит все участки, оператор — свои', async () => {
    const { granted } = makeScopeGuard(world);
    const requirement = requirementOf('marketplace-writeoff.resolver.ts', 'marketplaceWriteoffPendingConfirmations');
    await expect(granted(requirement, council)).resolves.toMatchObject({ kus: null });
    await expect(granted(requirement, chairOdn)).resolves.toMatchObject({ kus: ['odn'] });
  });

  // mkt.scopes.side.07
  it('ход выдач и докладка: оператору — участок запроса, заказчику — своё', async () => {
    const { granted } = makeScopeGuard(world);
    for (const [file, operation] of [
      ['marketplace-issuance.resolver.ts', 'marketplaceListIssuanceSagas'],
      ['marketplace-stock.resolver.ts', 'marketplaceListStockProposals'],
    ]) {
      const requirement = requirementOf(file, operation);
      await expect(granted(requirement, chairOdn, { data: { braname: 'odn' } })).resolves.toMatchObject({ kus: ['odn'] });
      await expect(granted(requirement, chairOdn, { data: { braname: 'krg' } })).rejects.toMatchObject(OWN_KU);
      const own = await granted(requirement, ivan, { data: { braname: 'krg' } });
      expect(own.scopes).toEqual(['own']);
      expect(own.kus).toBeUndefined();
    }
  });
});

describe('объекта нет', () => {
  // mkt.scopes.side.08
  it('гард пропускает запрос дальше: «не найдено» отвечает сама операция', async () => {
    const { granted } = makeScopeGuard({ branches: BRANCHES });
    const requirement = requirementOf('marketplace-order.resolver.ts', 'marketplaceCancelOrder');
    await expect(granted(requirement, ivan, { input: { order_id: 'нет-такого' } })).resolves.toMatchObject({ scopes: [] });
  });
});
