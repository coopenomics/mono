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
}

function buildService(setup: StandSetup = {}) {
  const {
    weights = [],
    totals = [],
    balances = [],
    reserve = 0,
    trustee = CHAIRMAN,
    feePercent = null,
  } = setup;

  const chainPort = {
    getBranchWeights: jest.fn().mockResolvedValue(weights),
    getBranchWeightTotals: jest.fn().mockResolvedValue(totals),
    listBranchWalletBalances: jest.fn().mockResolvedValue(balances),
    getEconomyConfig: jest
      .fn()
      .mockResolvedValue(feePercent === null ? null : { membership_fee_percent: feePercent }),
    distribute: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
    setFee: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
    setWeight: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
    delWeight: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const kuChairmanService = {
    getTrusteeOfBranch: jest.fn().mockResolvedValue(trustee),
    isMemberOfBranch: jest.fn().mockResolvedValue(true),
  } as any;

  const expensePlansService = {
    getReservedAmount: jest.fn().mockResolvedValue(reserve),
  } as any;

  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };

  const service = new MarketplaceEconomyService(
    chainPort,
    kuChairmanService,
    assetConfig,
    {} as any, // documentDomainService — заявление на матпомощь здесь не собирается
    expensePlansService,
    {} as any, // ledger2History — история кошелька проверяется отдельно
    {} as any, // coreGateway
    {} as any, // paymentMethodRepo
    {} as any, // orderRepo
    {} as any // expenseChassis
  );

  return { service, chainPort, kuChairmanService, expensePlansService };
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
  it('кооператив ставку не задавал — действует умолчание 30%', async () => {
    const { service } = buildService({ feePercent: null });

    expect(await service.getMembershipFeePercent(COOP)).toBe(30);
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
