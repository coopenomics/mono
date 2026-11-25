/**
 * Сводка участка для пайщика — вкладка «Стол заказов» на странице
 * кооперативного участка.
 *
 * Каждый пайщик кооператива видит по любому участку пункт выдачи с режимом
 * работы, остатки двух кошельков участка, итоги взносов инициаторов и движения
 * общего кошелька. Проверяется граница открытого: раздел пуст, когда участок в
 * нём не участвует, а из движений убраны получатель, заказ и назначение —
 * по ним читаются чужие заказы и выплаты. Ошибка здесь — это либо чужие данные
 * у постороннего пайщика, либо вкладка у участка, который пунктом выдачи не был.
 */
import { MarketContract } from 'cooptypes';
import { MarketplaceBranchSummaryService } from '~/extensions/marketplace/application/services/marketplace-branch-summary.service';
import { MarketplaceInvestmentService } from '~/extensions/marketplace/application/services/marketplace-investment.service';
import { toMarketplaceBranchSummaryDTO } from '~/extensions/marketplace/application/dto/marketplace-branch-summary.dto';
import { canAccess, rightsFor } from '~/extensions/marketplace/application/access/marketplace-access-matrix';
import { KuDetailsStatuses } from '~/extensions/marketplace/domain/entities/ku-details-domain.entity';

const COOP = 'voskhod';
const BRANCH = 'krg';

const toUnits = (asset: string): bigint => BigInt(asset.split(' ')[0].replace('.', ''));
function toAsset(units: bigint): string {
  const padded = units.toString().padStart(5, '0');
  return `${padded.slice(0, -4)}.${padded.slice(-4)} RUB`;
}
const rub = (n: number) => BigInt(n) * 10_000n;
/** Масштаб накопленного начисления на единицу базы — как в контракте. */
const S = MarketContract.PeriodModel.CRPS_SCALE;

const WORKING_HOURS = { mon: { open: '10:00', close: '19:00', breaks: [] } };

interface Setup {
  /** Строка пункта выдачи участка; null — участок не подключён как пункт выдачи. */
  details?: { status: string; workingHours: unknown } | null;
  /** Итоги взносов инициаторов; null — инициаторов у участка нет. */
  initiators?: { money_total: bigint; property_total: bigint; repaid_total: bigint; outstanding: bigint } | null;
}

function buildSummary(setup: Setup = {}) {
  const kuDetails = { findByCoreBraname: jest.fn(async () => setup.details ?? null) };
  const economy = {
    getBranchWalletBalances: jest.fn(async () => ({ common_balance: '1500.0000 RUB', social_fund_balance: '300.0000 RUB' })),
    getBranchWalletHistory: jest.fn(async () => ({
      items: [
        {
          global_sequence: '42',
          operation_code: 'o.brn.release',
          quantity: '700.0000 RUB',
          memo: 'распределение доверенным',
          order_hash: 'ab'.repeat(32),
          order_id: '17',
          username: 'anna',
          created_at: new Date('2026-11-20T10:00:00Z'),
        },
      ],
      totalCount: 1,
      totalPages: 1,
      currentPage: 1,
    })),
  };
  const investment = { getBranchInitiatorTotals: jest.fn(async () => setup.initiators ?? null) };
  const service = new MarketplaceBranchSummaryService(kuDetails as any, economy as any, investment as any);
  return { service, kuDetails, economy, investment };
}

/** Строка участка в таблице взносов инициаторов. */
function investBranchRow(over: Partial<Record<'money_total' | 'property_total' | 'repaid_total', bigint>> = {}) {
  const property = over.property_total ?? rub(1_000_000);
  const repaid = over.repaid_total ?? rub(100_000);
  const base = property > 0n ? property : 0n;
  return {
    braname: BRANCH,
    money_total: toAsset(over.money_total ?? 0n),
    property_total: toAsset(property),
    unused_total: toAsset(0n),
    reserved: toAsset(0n),
    spent_total: toAsset(0n),
    repaid_total: toAsset(repaid),
    surplus_total: toAsset(0n),
    base: String(base),
    acc: base > 0n ? String((repaid * S) / base) : '0',
    s_join: '0',
    s_fixed: '0',
    join_seq: 2,
  };
}

function buildInvestment(branch: ReturnType<typeof investBranchRow> | null) {
  const chainPort = {
    getInvestBranch: jest.fn(async () => branch),
    listBranchInvestors: jest.fn(async () => []),
  };
  const economyService = { assetToUnits: toUnits, unitsToAsset: toAsset };
  const service = new MarketplaceInvestmentService(
    chainPort as any,
    {} as any,
    economyService as any,
    {} as any,
    {} as any,
    { setContext: jest.fn(), log: jest.fn(), warn: jest.fn() } as any,
    null,
    {} as any
  );
  return { service, chainPort };
}

describe('mkt.branch-summary — сводка участка для пайщика', () => {
  it('summary.01 — участок-пункт выдачи с инициаторами: режим работы, остатки кошельков и итоги взносов', async () => {
    const initiators = { money_total: rub(50_000), property_total: rub(1_000_000), repaid_total: rub(100_000), outstanding: rub(20_000) };
    const { service } = buildSummary({ details: { status: KuDetailsStatuses.ACTIVE, workingHours: WORKING_HOURS }, initiators });

    const view = await service.getSummary(COOP, BRANCH);

    expect(view).toEqual({
      braname: BRANCH,
      issuance_point: { working_hours: WORKING_HOURS, active: true },
      common_balance: '1500.0000 RUB',
      social_fund_balance: '300.0000 RUB',
      initiators,
    });
    // Итоги инициаторов отдаются суммами актива, остатки кошельков — в том виде, в каком их отдала цепь.
    expect(toMarketplaceBranchSummaryDTO(view, toAsset).initiators).toEqual({
      money_total: '50000.0000 RUB',
      property_total: '1000000.0000 RUB',
      repaid_total: '100000.0000 RUB',
      outstanding: '20000.0000 RUB',
    });
  });

  it('summary.02 — участок без пункта выдачи и без инициаторов: оба раздела пусты', async () => {
    const { service } = buildSummary();

    const view = await service.getSummary(COOP, BRANCH);

    expect(view.issuance_point).toBeNull();
    expect(view.initiators).toBeNull();
    expect(toMarketplaceBranchSummaryDTO(view, toAsset)).toMatchObject({ issuance_point: null, initiators: null });
  });

  it('summary.03 — выключенный пункт выдачи остаётся в сводке с признаком «не работает»', async () => {
    const { service } = buildSummary({ details: { status: KuDetailsStatuses.INACTIVE, workingHours: WORKING_HOURS } });

    expect((await service.getSummary(COOP, BRANCH)).issuance_point).toEqual({ working_hours: WORKING_HOURS, active: false });
  });

  it('summary.04 — сводка читает данные своего участка точечно', async () => {
    const { service, kuDetails, economy, investment } = buildSummary();

    await service.getSummary(COOP, BRANCH);

    expect(kuDetails.findByCoreBraname).toHaveBeenCalledWith(COOP, BRANCH);
    expect(economy.getBranchWalletBalances).toHaveBeenCalledWith(COOP, BRANCH);
    expect(investment.getBranchInitiatorTotals).toHaveBeenCalledWith(COOP, BRANCH);
  });

  it('summary.05 — движение общего кошелька отдаётся без получателя, заказа и назначения', async () => {
    const { service, economy } = buildSummary();

    const page = await service.getMovements(COOP, BRANCH, { page: 2, limit: 20 } as any);

    expect(economy.getBranchWalletHistory).toHaveBeenCalledWith(COOP, BRANCH, { page: 2, limit: 20 });
    expect(page.totalCount).toBe(1);
    expect(page.items).toEqual([
      { global_sequence: '42', operation_code: 'o.brn.release', quantity: '700.0000 RUB', created_at: new Date('2026-11-20T10:00:00Z') },
    ]);
    expect(Object.keys(page.items[0]).sort()).toEqual(['created_at', 'global_sequence', 'operation_code', 'quantity']);
  });
});

describe('mkt.branch-summary — итоги взносов инициаторов участка', () => {
  it('initiators.01 — итоги берутся из одной строки участка, без чтения инициаторов', async () => {
    const { service, chainPort } = buildInvestment(investBranchRow());

    const totals = await service.getBranchInitiatorTotals(COOP, BRANCH);

    const model = MarketContract.PeriodModel;
    expect(totals).toEqual({
      money_total: 0n,
      property_total: rub(1_000_000),
      repaid_total: rub(100_000),
      outstanding: model.crpsOutstanding({
        base: rub(1_000_000),
        acc: (rub(100_000) * S) / rub(1_000_000),
        sJoin: 0n,
        sFixed: 0n,
        unusedTotal: 0n,
        reserved: 0n,
      }),
    });
    expect(chainPort.getInvestBranch).toHaveBeenCalledWith(COOP, BRANCH);
    expect(chainPort.listBranchInvestors).not.toHaveBeenCalled();
  });

  it('initiators.02 — строки участка нет: инициаторов нет', async () => {
    expect(await buildInvestment(null).service.getBranchInitiatorTotals(COOP, BRANCH)).toBeNull();
  });

  it('initiators.03 — строка участка с нулевыми взносами и возмещением: инициаторов нет', async () => {
    const empty = investBranchRow({ money_total: 0n, property_total: 0n, repaid_total: 0n });

    expect(await buildInvestment(empty).service.getBranchInitiatorTotals(COOP, BRANCH)).toBeNull();
  });

  it('initiators.04 — взнос только деньгами делает участок участком с инициаторами', async () => {
    const moneyOnly = investBranchRow({ money_total: rub(5_000), property_total: 0n, repaid_total: 0n });

    expect(await buildInvestment(moneyOnly).service.getBranchInitiatorTotals(COOP, BRANCH)).toMatchObject({
      money_total: rub(5_000),
      property_total: 0n,
      repaid_total: 0n,
    });
  });
});

describe('mkt.branch-summary — право чтения сводки', () => {
  it('rights.01 — пайщик читает сводку участка, когда совет подключил Стол заказов', () => {
    expect(canAccess(['orderer'], 'BranchSummary', 'read')).toBe(true);
    expect(rightsFor(['orderer'], new Set(['coop-accepted']))).toContain('BranchSummary:read');
  });

  it('rights.02 — до подключения Стола заказов советом сводка закрыта', () => {
    expect(rightsFor(['orderer'], new Set())).not.toContain('BranchSummary:read');
  });

  it('rights.03 — право сводки не открывает пайщику экономику участка председателя', () => {
    expect(canAccess(['orderer'], 'Economy', 'read:own-KU')).toBe(false);
  });
});
