/**
 * Экономика кооперативного участка: членские взносы на балансе и их
 * распределение по доверенным согласно сетке весов.
 *
 * Членский взнос с каждого исполненного заказа оседает в общем кошельке
 * участка (`w.brn.common`). Председатель участка распределяет его между
 * доверенными: у каждого свой вес, доля считается как вес / Σ весов. Часть
 * общего кошелька заморожена плановым резервом расходов ближайших 30 дней —
 * распределить её нельзя, иначе участку нечем будет платить по плану.
 *
 * Проверяется денежная сторона: что показано на балансе, сколько доступно к
 * распределению и кто вправе трогать сетку. Ошибка здесь — это либо чужие
 * деньги в чужих руках, либо участок без средств на плановый расход.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Registry } from '@coopenomics/docs-templates';
import { MarketplaceEconomyService } from '~/extensions/marketplace/application/services/marketplace-economy.service';
import type { MarketplaceCanonicalBlockchainPort } from '~/extensions/marketplace/domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from '~/extensions/marketplace/application/services/marketplace-asset.config';

const COOP = 'voskhod';
const BRANCH = 'krg';
const CHAIRMAN = 'chairkrg';

/** Контрактная шкала процентов: 1 000 000 = 100%. */
const HUNDR_PERCENTS = 1_000_000;

type Weight = { coopname: string; braname: string; contract: string; username: string; weight: number };
type Total = { coopname: string; braname: string; contract: string; total_weight: number };
type Balance = { wallet_name: string; username: string; available: string };

interface StandSetup {
  weights?: Weight[];
  totals?: Total[];
  balances?: Balance[];
  /** Плановый резерв расходов участка на 30 дней, в рублях. */
  reserve?: number;
  /** Кто числится председателем участка; null — участок без председателя. */
  trustee?: string | null;
  /** Ставка членского взноса on-chain; null — кооператив её не задавал. */
  feePercent?: number | null;
  /** Строка паевых взносов инициаторов участка; null — инициаторов нет. */
  investBranch?: { unused_total: string; reserved: string } | null;
}

function buildService(setup: StandSetup = {}) {
  const {
    weights = [],
    totals = [],
    balances = [],
    reserve = 0,
    trustee = CHAIRMAN,
    feePercent = null,
    investBranch = null,
  } = setup;

  const chainPort = {
    // Цепь отдаёт веса по индексу участка и кошелёк по индексу владельца — заглушки отбирают так же.
    getBranchWeights: jest.fn(async (_coopname: string, braname: string) => weights.filter((w) => w.braname === braname)),
    getBranchWeightTotals: jest.fn(async (_coopname: string, braname: string) => totals.filter((t) => t.braname === braname)),
    getUserWallet: jest.fn(
      async (_coopname: string, walletName: string, username: string) =>
        balances.find((b) => b.wallet_name === walletName && b.username === username) ?? null
    ),
    getEconomyConfig: jest
      .fn()
      .mockResolvedValue(feePercent === null ? null : { membership_fee_percent: feePercent }),
    distribute: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
    setFee: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
    setWeight: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
    delWeight: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
    getInvestBranch: jest.fn().mockResolvedValue(investBranch),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const kuChairmanService = {
    getTrusteeOfBranch: jest.fn().mockResolvedValue(trustee),
    isMemberOfBranch: jest.fn().mockResolvedValue(true),
  } as any;

  // Резерв общего кошелька — цель плановых расходов (задача 99D-34): реестр
  // планов участка из шасси расходов, неоплаченные записи со сроком до конца
  // текущего месяца. Здесь резерв — одна просроченная неоплаченная запись.
  const expenseChassis = {
    listPlans: jest.fn().mockResolvedValue(
      reserve > 0
        ? [{ id: 1, branchName: BRANCH, title: 'Аренда', amount: `${reserve.toFixed(4)} RUB`, dueDate: new Date(Date.now() - 86_400_000), proposalHash: null, paidAt: null }]
        : []
    ),
    attachPlanToProposal: jest.fn().mockResolvedValue(undefined),
  } as any;

  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };

  const service = new MarketplaceEconomyService(
    chainPort,
    kuChairmanService,
    assetConfig,
    {} as any, // documentDomainService — заявление на матпомощь здесь не собирается
    {} as any, // ledger2History — история кошелька проверяется отдельно
    {} as any, // coreGateway
    {} as any, // paymentMethodRepo
    {} as any, // orderRepo
    expenseChassis,
    {} as any // aidStore — зеркало заявлений на матпомощь здесь не читается
  );

  return { service, chainPort, kuChairmanService, expenseChassis };
}

const weight = (username: string, w: number, over: Partial<Weight> = {}): Weight => ({
  coopname: COOP,
  braname: BRANCH,
  contract: 'marketplace',
  username,
  weight: w,
  ...over,
});

const common = (amount: string): Balance => ({
  wallet_name: 'w.brn.common',
  username: BRANCH,
  available: `${amount} RUB`,
});

const personal = (username: string, amount: string): Balance => ({
  wallet_name: 'w.brn.person',
  username,
  available: `${amount} RUB`,
});

describe('Членские взносы на балансе участка', () => {
  it('общий кошелёк, резерв и доступное к распределению показаны раздельно', async () => {
    const { service } = buildService({
      balances: [common('10000.0000')],
      reserve: 2500,
    });

    const economy = await service.getBranchEconomy(COOP, BRANCH);

    expect(economy.common_balance).toBe('10000.0000 RUB');
    expect(economy.reserve_amount).toBe('2500.0000 RUB');
    // Заморожённый резерв не распределяется: участку нужно чем-то платить по плану.
    expect(economy.available_to_distribute).toBe('7500.0000 RUB');
  });

  it('резерв больше остатка — доступно ноль, а не отрицательная сумма', async () => {
    const { service } = buildService({
      balances: [common('1000.0000')],
      reserve: 4000,
    });

    const economy = await service.getBranchEconomy(COOP, BRANCH);

    expect(economy.available_to_distribute).toBe('0.0000 RUB');
  });

  it('кошелёк участка пуст — показывается ноль, а не пропуск строки', async () => {
    const { service } = buildService({ balances: [] });

    const economy = await service.getBranchEconomy(COOP, BRANCH);

    expect(economy.common_balance).toBe('0.0000 RUB');
    expect(economy.available_to_distribute).toBe('0.0000 RUB');
  });
});

describe('Сетка распределения: доли доверенных', () => {
  it('доля считается от суммы весов, а не от числа участников', async () => {
    const { service } = buildService({
      weights: [weight('chairkrg', 3), weight('trusted1', 1)],
      totals: [{ coopname: COOP, braname: BRANCH, contract: 'marketplace', total_weight: 4 }],
      balances: [common('4000.0000'), personal('chairkrg', '300.0000'), personal('trusted1', '100.0000')],
    });

    const economy = await service.getBranchEconomy(COOP, BRANCH);

    expect(economy.total_weight).toBe(4);
    const byName = Object.fromEntries(economy.weights.map((w) => [w.username, w]));
    expect(byName.chairkrg.share_percent).toBe(75);
    expect(byName.trusted1.share_percent).toBe(25);
    // Персональный кошелёк каждого — рядом с его долей, чтобы было видно,
    // что уже роздано.
    expect(byName.chairkrg.personal_balance).toBe('300.0000 RUB');
    expect(byName.trusted1.personal_balance).toBe('100.0000 RUB');
  });

  it('веса чужого участка и чужого контракта в сетку не попадают', async () => {
    const { service } = buildService({
      weights: [
        weight('chairkrg', 1),
        weight('chairkub', 5, { braname: 'kubra' }),
        weight('capitalman', 7, { contract: 'capital' }),
      ],
      totals: [{ coopname: COOP, braname: BRANCH, contract: 'marketplace', total_weight: 1 }],
    });

    const economy = await service.getBranchEconomy(COOP, BRANCH);

    expect(economy.weights.map((w) => w.username)).toEqual(['chairkrg']);
    expect(economy.total_weight).toBe(1);
  });

  it('сетка не настроена — доли нулевые, а не деление на ноль', async () => {
    const { service } = buildService({
      weights: [weight('chairkrg', 2)],
      totals: [],
    });

    const economy = await service.getBranchEconomy(COOP, BRANCH);

    expect(economy.total_weight).toBe(0);
    expect(economy.weights[0].share_percent).toBe(0);
  });

  it('доверенный участка без персонального кошелька показывается с нулём', async () => {
    const { service } = buildService({
      weights: [weight('trusted1', 1)],
      totals: [{ coopname: COOP, braname: BRANCH, contract: 'marketplace', total_weight: 1 }],
      balances: [common('500.0000')],
    });

    const economy = await service.getBranchEconomy(COOP, BRANCH);

    expect(economy.weights[0].personal_balance).toBe('0.0000 RUB');
  });
});

describe('Распределение членских взносов', () => {
  const ready = (over: StandSetup = {}) =>
    buildService({
      weights: [weight('chairkrg', 1), weight('trusted1', 1)],
      totals: [{ coopname: COOP, braname: BRANCH, contract: 'marketplace', total_weight: 2 }],
      balances: [common('10000.0000')],
      ...over,
    });

  it('председатель участка распределяет доступную сумму', async () => {
    const { service, chainPort } = ready({ reserve: 2000 });

    const asset = await service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, 8000);

    expect(asset).toBe('8000.0000 RUB');
    expect(chainPort.distribute).toHaveBeenCalledWith(
      expect.objectContaining({
        coopname: COOP,
        braname: BRANCH,
        source_contract: 'marketplace',
        amount: '8000.0000 RUB',
      })
    );
  });

  it('не председатель участка распределить не может', async () => {
    const { service, chainPort } = ready();

    await expect(service.distributeBranchFunds(COOP, 'trusted1', BRANCH, 100)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(chainPort.distribute).not.toHaveBeenCalled();
  });

  it('распределение сверх резерва отбивается — плановые расходы неприкосновенны', async () => {
    const { service, chainPort } = ready({ reserve: 3000 });

    // В кошельке 10 000, резерв 3 000 — распределить можно только 7 000.
    await expect(service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, 7001)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(chainPort.distribute).not.toHaveBeenCalled();
  });

  it('ровно доступная сумма проходит: граница резерва не отсекает лишнего', async () => {
    const { service, chainPort } = ready({ reserve: 3000 });

    await service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, 7000);

    expect(chainPort.distribute).toHaveBeenCalled();
  });

  it('сетка не задана — распределять некому', async () => {
    const { service, chainPort } = ready({ weights: [], totals: [] });

    await expect(service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, 100)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(chainPort.distribute).not.toHaveBeenCalled();
  });

  it('нулевая и отрицательная сумма до цепи не доходят', async () => {
    const { service, chainPort } = ready();

    await expect(service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, -500)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(chainPort.distribute).not.toHaveBeenCalled();
  });
});

describe('Одновременные распределения участка', () => {
  it('второе распределение читает остаток после первого: вместе они резерв плановых расходов не трогают', async () => {
    // Общий кошелёк 10 000, резерв 2 500 — распределить можно 7 500. Два
    // запроса по 5 000 пришли одновременно: по одному остатку оба прошли бы.
    const balances = [common('10000.0000')];
    const { service, chainPort } = buildService({ balances, reserve: 2500, weights: [weight(CHAIRMAN, 1)], totals: [{ coopname: COOP, braname: BRANCH, contract: 'marketplace', total_weight: 1 }] });
    chainPort.distribute.mockImplementation(async (data: any) => {
      // Цепь уменьшает общий кошелёк с задержкой на блок.
      await new Promise((resolve) => setImmediate(resolve));
      balances[0] = common((Number.parseFloat(balances[0].available) - Number.parseFloat(data.amount)).toFixed(4));
      return { transaction_id: 'tx' } as any;
    });
    const results = await Promise.allSettled([
      service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, 5000),
      service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, 5000),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(chainPort.distribute).toHaveBeenCalledTimes(1);
    expect(balances[0].available).toBe('5000.0000 RUB');
    // Очередь не застревает после отказа: следующее распределение в пределах доступного проходит.
    await expect(service.distributeBranchFunds(COOP, CHAIRMAN, BRANCH, 2500)).resolves.toBeDefined();
  });
});

describe('Правка сетки весов', () => {
  it('председатель задаёт вес доверенного', async () => {
    const { service, chainPort } = buildService();

    await service.setTrusteeWeight(COOP, CHAIRMAN, BRANCH, 'trusted1', 3);

    expect(chainPort.setWeight).toHaveBeenCalledWith(
      expect.objectContaining({ braname: BRANCH, contract: 'marketplace', username: 'trusted1', weight: 3 })
    );
  });

  it('дробный и нулевой вес не принимаются', async () => {
    const { service, chainPort } = buildService();

    await expect(service.setTrusteeWeight(COOP, CHAIRMAN, BRANCH, 'trusted1', 1.5)).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.setTrusteeWeight(COOP, CHAIRMAN, BRANCH, 'trusted1', 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(chainPort.setWeight).not.toHaveBeenCalled();
  });

  it('чужой участок сетку не правит — ни задать вес, ни исключить участника', async () => {
    const { service, chainPort } = buildService({ trustee: 'chairkub' });

    await expect(service.setTrusteeWeight(COOP, CHAIRMAN, BRANCH, 'trusted1', 1)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(service.deleteTrusteeWeight(COOP, CHAIRMAN, BRANCH, 'trusted1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(chainPort.setWeight).not.toHaveBeenCalled();
    expect(chainPort.delWeight).not.toHaveBeenCalled();
  });
});

describe('Ставка членского взноса', () => {
  it('кооператив ставку не задавал — действует умолчание 38 % (решение владельца 02.11.2026)', async () => {
    const { service } = buildService({ feePercent: null });

    expect(await service.getMembershipFeePercent(COOP)).toBe(38);
  });

  it('заданная ставка переводится из контрактной шкалы в проценты', async () => {
    const { service } = buildService({ feePercent: 125_000 });

    expect(await service.getMembershipFeePercent(COOP)).toBe(12.5);
  });

  it('установка ставки уходит на цепь в контрактной шкале', async () => {
    const { service, chainPort } = buildService();

    const applied = await service.setMembershipFee(COOP, 12.5);

    expect(applied).toBe(12.5);
    expect(chainPort.setFee).toHaveBeenCalledWith({
      coopname: COOP,
      membership_fee_percent: (12.5 * HUNDR_PERCENTS) / 100,
    });
  });

  it('ставка вне диапазона 0…100 на цепь не уходит', async () => {
    const { service, chainPort } = buildService();

    await expect(service.setMembershipFee(COOP, 101)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setMembershipFee(COOP, -1)).rejects.toBeInstanceOf(BadRequestException);
    expect(chainPort.setFee).not.toHaveBeenCalled();
  });
});

describe('Заявление на материальную помощь: источник денег до цепи', () => {
  // Подпись и реквизиты здесь не проверяются: заявление подписано, реквизитов
  // в заглушке нет — значит, дошли до них, и проверка денег пройдена.
  const signed = (amount: number) => ({ meta: { registry_id: Registry.BranchFinancialAidStatement.registry_id, aid_hash: 'h1', amount: `${amount.toFixed(4)} RUB` } }) as any;
  const submit = (setup: StandSetup, amount: number) => {
    const { service } = buildService(setup);
    jest.spyOn(service as any, 'verifyDocumentSignature').mockImplementation(() => undefined);
    return service.createAid(COOP, CHAIRMAN, BRANCH, amount, 'h1', signed(amount), 'pm-1');
  };

  it('персонального кошелька хватает — проверка денег пройдена', async () => {
    await expect(submit({ balances: [personal(CHAIRMAN, '150.0000')] }, 100)).rejects.toMatchObject({ code: 'MARKETPLACE_PAYMENT_DETAILS_NOT_FOUND' });
  });

  it('персональный пуст, у инициаторов участка свободно достаточно — заявление идёт в цепь, как принимает контракт (99D-28)', async () => {
    const setup = { investBranch: { unused_total: '700.0000 RUB', reserved: '200.0000 RUB' } };
    await expect(submit(setup, 500)).rejects.toMatchObject({ code: 'MARKETPLACE_PAYMENT_DETAILS_NOT_FOUND' });
  });

  it('не хватает ни персонального, ни свободных средств инициаторов — отказ до цепи с кодом', async () => {
    const setup = { balances: [personal(CHAIRMAN, '50.0000')], investBranch: { unused_total: '700.0000 RUB', reserved: '200.0000 RUB' } };
    await expect(submit(setup, 501)).rejects.toMatchObject({ code: 'MARKETPLACE_PERSONAL_WALLET_INSUFFICIENT_FUNDS' });
    await expect(submit({ balances: [personal(CHAIRMAN, '50.0000')] }, 100)).rejects.toMatchObject({ code: 'MARKETPLACE_PERSONAL_WALLET_INSUFFICIENT_FUNDS' });
  });
});

describe('Записка на расход по записи плана: проверка записи до цепи', () => {
  // Контракт о реестре планов не знает: вторую записку по той же записи он
  // примет, участок выделит деньги дважды, а совет получит два вопроса об одном
  // расходе. Поэтому запись проверяет узел — до отправки в цепь.
  const input = (planId: number) => ({ braname: BRANCH, expense_hash: 'e'.repeat(64), items: [], statement: {}, plan_id: planId }) as any;
  const plan = (over: Record<string, unknown> = {}) => ({ id: 7, branchName: BRANCH, title: 'Аренда', amount: '50000.0000 RUB', dueDate: new Date(), proposalHash: null, paidAt: null, ...over });

  function build(plans: unknown[]) {
    const ctx = buildService({});
    ctx.expenseChassis.listPlans.mockResolvedValue(plans);
    jest.spyOn(ctx.service as any, 'verifyDocumentSignature').mockImplementation(() => undefined);
    const submit = jest.spyOn(ctx.service as any, 'submitBranchExpense').mockResolvedValue('e'.repeat(64));
    return { ...ctx, submit };
  }

  it('оплата по записи уже запущена — вторая записка в цепь не подаётся', async () => {
    const { service, submit } = build([plan({ proposalHash: 'a'.repeat(64) })]);
    await expect(service.createBranchExpense(COOP, CHAIRMAN, input(7))).rejects.toMatchObject({ code: 'EXPENSES_PLAN_PAYMENT_ALREADY_STARTED' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('запись уже оплачена — записка в цепь не подаётся', async () => {
    const { service, submit } = build([plan({ paidAt: new Date() })]);
    await expect(service.createBranchExpense(COOP, CHAIRMAN, input(7))).rejects.toMatchObject({ code: 'EXPENSES_PLAN_PAYMENT_ALREADY_STARTED' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('записи нет в реестре этого участка — отказ до цепи', async () => {
    const { service, submit } = build([plan({ id: 8 }), plan({ id: 7, branchName: 'odn' })]);
    await expect(service.createBranchExpense(COOP, CHAIRMAN, input(7))).rejects.toMatchObject({ code: 'EXPENSES_PLAN_NOT_FOUND' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('две подачи по одной записи одновременно: вторая отклоняется, пока первая в цепи; после первой запись снова проверяется по реестру', async () => {
    const { service, submit } = build([plan()]);
    let release: (hash: string) => void = () => undefined;
    submit.mockImplementationOnce(() => new Promise<string>((resolve) => { release = resolve; }));
    const first = service.createBranchExpense(COOP, CHAIRMAN, input(7));
    // Первая подача дошла до цепи и ждёт ответа.
    await new Promise((resolve) => setImmediate(resolve));
    await expect(service.createBranchExpense(COOP, CHAIRMAN, input(7))).rejects.toMatchObject({ code: 'EXPENSES_PLAN_PAYMENT_ALREADY_STARTED' });
    release('e'.repeat(64));
    await expect(first).resolves.toBe('e'.repeat(64));
    expect(submit).toHaveBeenCalledTimes(1);
    // Первая подача упала бы — запись освобождается, и подать можно заново.
    await expect(service.createBranchExpense(COOP, CHAIRMAN, input(7))).resolves.toBe('e'.repeat(64));
  });

  // Запись со способом оплаты (99D-35): записку собирает стол, но сервер сверяет
  // её с записью — иначе по записи «электроэнергия» можно заплатить другому.
  const orgPlan = plan({ recipientType: 'ORG', counterpartyId: 3, paymentPurpose: 'Оплата электроэнергии' });
  const advancePlan = plan({ recipientType: 'MEMBER', recipient: 'petrov', paymentMethodId: 'm2' });
  const orgItem = (over: Record<string, unknown> = {}) => ({
    item_hash: 'f'.repeat(64), mechanics: 'DIRECT', recipient_type: 'ORG', recipient: '', description: 'Аренда',
    planned_amount: '50000.0000 RUB', counterparty_id: 3, payment_purpose: 'Оплата электроэнергии', ...over,
  });
  const advanceItem = (over: Record<string, unknown> = {}) => ({
    item_hash: 'f'.repeat(64), mechanics: 'ADVANCE', recipient_type: 'MEMBER', recipient: 'petrov', description: 'Аренда',
    planned_amount: '50000.0000 RUB', payment_method_id: 'm2', ...over,
  });
  const withItems = (items: unknown[]) => ({ ...input(7), items });

  it('записка совпадает с записью плана — подаётся (организация и аванс)', async () => {
    const org = build([orgPlan]);
    await expect(org.service.createBranchExpense(COOP, CHAIRMAN, withItems([orgItem()]))).resolves.toBe('e'.repeat(64));
    const adv = build([advancePlan]);
    await expect(adv.service.createBranchExpense(COOP, CHAIRMAN, withItems([advanceItem()]))).resolves.toBe('e'.repeat(64));
  });

  it.each([
    ['planned_amount', orgItem({ planned_amount: '50000.0001 RUB' })],
    ['recipient_type', advanceItem()],
    ['counterparty_id', orgItem({ counterparty_id: 4 })],
    ['payment_purpose', orgItem({ payment_purpose: 'Оплата чужого счёта' })],
  ])('организация: расхождение в %s — отказ до цепи', async (field, item) => {
    const { service, submit } = build([orgPlan]);
    await expect(service.createBranchExpense(COOP, CHAIRMAN, withItems([item]))).rejects.toMatchObject({ code: 'EXPENSES_PLAN_PROPOSAL_MISMATCH' });
    expect(submit).not.toHaveBeenCalled();
    expect(field).toBeTruthy();
  });

  it.each([
    ['recipient', advanceItem({ recipient: 'sidorov' })],
    ['payment_method_id', advanceItem({ payment_method_id: 'm9' })],
  ])('аванс: расхождение в %s — отказ до цепи', async (_field, item) => {
    const { service, submit } = build([advancePlan]);
    await expect(service.createBranchExpense(COOP, CHAIRMAN, withItems([item]))).rejects.toMatchObject({ code: 'EXPENSES_PLAN_PROPOSAL_MISMATCH' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('два пункта в записке по одной записи — отказ: запись — один платёж', async () => {
    const { service, submit } = build([orgPlan]);
    await expect(service.createBranchExpense(COOP, CHAIRMAN, withItems([orgItem(), orgItem()]))).rejects.toMatchObject({ code: 'EXPENSES_PLAN_PROPOSAL_MISMATCH' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('запись до способов оплаты сверку пунктов не проходит — подаётся, как прежде', async () => {
    const { service, submit } = build([plan()]);
    await expect(service.createBranchExpense(COOP, CHAIRMAN, withItems([orgItem({ counterparty_id: 99 })]))).resolves.toBe('e'.repeat(64));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('записка без записи плана реестр не читает', async () => {
    const { service, submit, expenseChassis } = build([]);
    await service.createBranchExpense(COOP, CHAIRMAN, { ...input(7), plan_id: undefined });
    expect(expenseChassis.listPlans).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
