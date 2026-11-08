/**
 * Мир для тестов цикла коэффициента экономического участия: настоящие сервисы
 * ИСТОКА (учёт обеспечительной части, прогон первого числа, итог месяца) поверх
 * подставной цепи и таблиц в памяти.
 *
 * Подставная цепь считает итог месяца и деление списания эталоном
 * `MarketContract.PeriodModel` — той же арифметикой, что контракты; тест цепи
 * `boot/src/tests/marketplace-period-math.test.ts` сверяет эталон с контрактом.
 * Цепь ведёт кошельки, строки `kuperiods` и отвечает отказами контракта с их
 * кодами. Операции ledger2 одной транзакции отдаются слушателю разом, без
 * ожидания между ними, — как их выпускает шина событий узла.
 */
import { MarketContract } from 'cooptypes';
import { memoryTable, toAsset, toUnits } from './memory-table';
import { MarketplaceSecureDueOperation, MarketplaceSecureDueService } from '~/extensions/marketplace/application/services/marketplace-secure-due.service';
import { MarketplacePeriodService } from '~/extensions/marketplace/application/services/marketplace-period.service';
import type { MarketplaceSecureDueEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-secure-due.entity';
import type { MarketplaceBranchPeriodEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-branch-period.entity';

const Model = MarketContract.PeriodModel;

export { toAsset, toUnits };

export const COOP = 'voskhod';
export const TIMEZONE = 'Europe/Moscow';

/** Рубли в единицы актива: четыре знака. */
export const rub = (value: number): bigint => BigInt(Math.round(value * 10_000));

/** 00:30 первого числа месяца по Москве — первый проход крона в новом месяце. */
export function firstOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 0, 30) - 3 * 60 * 60 * 1000);
}

/** Полдень заданного дня по Москве. */
export function dayOf(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 9, 0));
}

/** Номер месяца, как его считает ИСТОК: год × 12 + месяц. */
export const periodOf = (year: number, month: number): number => year * 12 + month;

/** Отказ контракта в том виде, в каком его отдаёт цепь. */
function refusal(code: string, text: string): Error {
  return new Error(`assertion failure with message: ${code}: ${text}`);
}

/**
 * Суммы по строкам учёта поверх таблицы в памяти — те же отборы, что делает
 * `MarketplaceSecureDueRunQueries` запросами к базе.
 */
export function runQueriesOver(table: { rows: Map<string, MarketplaceSecureDueEntity> }) {
  const all = () => [...table.rows.values()];
  const open = (row: MarketplaceSecureDueEntity) => row.charged_at == null && toUnits(row.due_amount) > 0n;
  const unsent = (row: MarketplaceSecureDueEntity) => row.charge_sent_at == null;
  const totals = (list: MarketplaceSecureDueEntity[]) => ({
    turnover: toAsset(list.reduce((s, r) => s + toUnits(r.base_amount), 0n)).split(' ')[0] ?? '0',
    secured: toAsset(list.reduce((s, r) => s + toUnits(r.due_amount), 0n)).split(' ')[0] ?? '0',
    rows: list.length,
  });
  return {
    async ripeBranches(coopname: string, before: Date): Promise<string[]> {
      const ripe = all().filter((r) => r.coopname === coopname && open(r) && unsent(r) && r.due_from != null && r.due_from < before && toUnits(r.base_amount) > 0n);
      return [...new Set(ripe.map((r) => r.braname))].sort();
    },
    async runTotals(coopname: string, braname: string, period: number) {
      return totals(all().filter((r) => r.coopname === coopname && r.braname === braname && r.run_period === period && open(r) && unsent(r)));
    },
    async ripeningTotals(coopname: string, braname: string, before: Date) {
      return totals(all().filter((r) => r.coopname === coopname && r.braname === braname && open(r) && r.due_from != null && r.due_from < before));
    },
  };
}

/** Заказ, выданный пайщику: стоимость и обеспечительная часть, которую провёл контракт. */
export interface IssuedOrder {
  hash: string;
  username: string;
  braname: string;
  base: bigint;
  due: bigint;
  issuedAt: Date;
  warrantyUntil?: Date | null;
}

interface ChainPeriod {
  id: number;
  braname: string;
  period: number;
  totals: MarketContract.PeriodModel.IPeriodTotals;
  facts: MarketContract.PeriodModel.IPeriodFacts;
  initiator: string;
}

interface AppliedOp {
  code: MarketplaceSecureDueOperation;
  units: bigint;
  username: string;
  hash: string;
  at: Date;
}

export function createKeuWorld() {
  const dueStore = memoryTable<MarketplaceSecureDueEntity>((row) => row.order_hash);
  const periodStore = memoryTable<MarketplaceBranchPeriodEntity>((row) => `${row.coopname}/${row.braname}/${row.period}`);

  // ── Состояние цепи ────────────────────────────────────────────────────
  const wallets = {
    due: new Map<string, bigint>(),
    share: new Map<string, bigint>(),
    branch: new Map<string, bigint>(),
    invest: new Map<string, bigint>(),
    /** Кошелёк возмещения паевых взносов участка `w.mkt.repay` (99D-27). */
    repay: new Map<string, bigint>(),
    funds: 0n,
  };
  /**
   * Паевые взносы инициаторов участка (`invbranches`, 99D-27): база возврата,
   * счётчик CRPS и возмещено всего. Участок без строки — паевых взносов нет, доля
   * инициатора как прежде направляется инициатору участка.
   */
  const invest = new Map<string, { base: bigint; acc: bigint; sJoin: bigint; sFixed: bigint; unusedTotal: bigint; reserved: bigint; property: bigint; repaid: bigint }>();
  const add = (map: Map<string, bigint>, key: string, units: bigint) => map.set(key, (map.get(key) ?? 0n) + units);
  const periods: ChainPeriod[] = [];
  const orders = new Map<string, IssuedOrder>();
  const settings = {
    fundsPercent: 210_000n,
    initiatorPercent: 618_000n,
    /** Резерв социально-экономического обеспечения участка. */
    reserve: new Map<string, bigint>(),
    /** Плановые расходы участков: запись реестра планов со сроком. */
    plans: [] as Array<{ branchName: string; dueDate: Date; amount: string; proposalHash?: string }>,
    /** Материальная помощь, выплаченная участком за месяц: участок/номер месяца → сумма. */
    aidPaid: new Map<string, bigint>(),
    initiator: new Map<string, string>(),
    openClaims: new Set<string>(),
    /** Журнал учёта участков для фактов месяца: служебные записки (o.brn.expfnd, o.mkt.ipool и возвраты). */
    ledger: [] as Array<{ operationCode: string; username: string; quantity: string; processHash: string; createdAt: Date }>,
    /** Хэши заявлений на материальную помощь: их выделение из средств инициаторов — не записка. */
    aidHashes: new Set<string>(),
  };
  const faults = {
    /** Очередь сбоев расчёта итога месяца: каждый вызов забирает один. */
    closePeriod: [] as Error[],
    /** Сбои списания по хэшу заказа. */
    chargePeriod: new Map<string, Error[]>(),
    /** Операции списания этих заказов до слушателя не доходят — сбой учёта. */
    lostEvents: new Set<string>(),
    /** Очередь сбоев чтения реестра плановых расходов: факты месяца не собраны. */
    plans: [] as Error[],
    /** Очередь сбоев чтения кошелька пайщика из цепи при сверке. */
    walletRead: [] as Error[],
  };
  const calls = {
    closePeriod: [] as any[],
    chargePeriod: [] as any[],
    chargeDue: [] as any[],
    deletePeriod: [] as any[],
    getUserWallet: [] as any[],
  };
  let sequence = 1;
  let clock = new Date('2027-01-01T00:00:00.000Z');

  // ── Слушатель операций ────────────────────────────────────────────────
  /** Операции одной транзакции отдаются слушателю разом — так их выпускает шина. */
  async function deliver(ops: AppliedOp[]): Promise<void> {
    const started = ops.map((op) =>
      dueService.onLedgerApply({
        transaction_id: 't',
        account: 'ledger2',
        block_num: sequence,
        block_id: 'b',
        block_time: op.at.toISOString(),
        chain_id: 'c',
        name: 'apply',
        receiver: 'ledger2',
        authorization: [],
        action_ordinal: 1,
        global_sequence: String(sequence++),
        account_ram_deltas: [],
        data: {
          coopname: COOP,
          initiator: 'marketplace',
          operation_code: op.code,
          process_type: 'p.mkt.supply',
          amount: toAsset(op.units),
          username: op.username,
          process_hash: op.hash.toUpperCase(),
          memo: '',
        },
      } as never)
    );
    await Promise.all(started);
  }

  // ── Подставная цепь ───────────────────────────────────────────────────
  const periodRowOf = (p: ChainPeriod) => ({
    id: p.id,
    braname: p.braname,
    period: p.period,
    turnover: toAsset(p.facts.turnover),
    secured: toAsset(p.facts.secured),
    planned: toAsset(p.facts.planned),
    memos: toAsset(p.facts.memos),
    aid_paid: toAsset(p.facts.aidPaid),
    aid_reserve: toAsset(p.facts.reserve),
    aid_unpaid: toAsset(p.totals.unpaid),
    expenses: toAsset(p.totals.expenses),
    membership: toAsset(p.totals.membership),
    funds_amount: toAsset(p.totals.funds),
    branch_amount: toAsset(p.totals.branch),
    initiator_amount: toAsset(p.totals.initiator),
    return_amount: toAsset(p.totals.returned),
    deficit: toAsset(p.totals.deficit),
    rate_branch: Number(p.totals.rateBranch),
    rate_funds: Number(p.totals.rateFunds),
    rate_initiator: Number(p.totals.rateInitiator),
    initiator: p.initiator,
    closed_at: clock.toISOString().replace('Z', ''),
  });

  const chainPort = {
    // Строка участка по паевым взносам инициаторов; нет строки — паевых взносов нет.
    async getInvestBranch(_coopname?: string, braname?: string) {
      const b = braname ? invest.get(braname) : undefined;
      if (!b) return null;
      return {
        braname,
        money_total: toAsset(0n),
        property_total: toAsset(b.property),
        unused_total: toAsset(b.unusedTotal),
        reserved: toAsset(b.reserved),
        spent_total: toAsset(0n),
        repaid_total: toAsset(b.repaid),
        surplus_total: toAsset(0n),
        base: String(b.base),
        acc: String(b.acc),
        s_join: String(b.sJoin),
        s_fixed: String(b.sFixed),
        join_seq: 1,
      };
    },
    async closePeriod(data: any) {
      calls.closePeriod.push(data);
      const fault = faults.closePeriod.shift();
      if (fault) throw fault;
      const turnover = toUnits(data.turnover);
      const secured = toUnits(data.secured);
      if (turnover <= 0n || secured <= 0n) throw refusal('MARKETPLACE_PERIOD_AMOUNT_INVALID', 'Стоимость заказов и собранная обеспечительная часть прогона должны быть больше нуля');
      if (periods.some((p) => p.braname === data.braname && p.period === data.period)) {
        throw refusal('MARKETPLACE_PERIOD_EXISTS', 'Итог участка за период уже рассчитан');
      }
      const earlier = periods.filter((p) => p.braname === data.braname && p.period < data.period);
      const prev = earlier.sort((a, b) => b.period - a.period)[0];
      const facts = {
        turnover,
        secured,
        planned: toUnits(data.planned),
        memos: toUnits(data.memos),
        aidPaid: toUnits(data.aid_paid),
        reserve: settings.reserve.get(data.braname) ?? 0n,
        reservePrev: prev ? prev.facts.reserve : 0n,
        fundsPercent: settings.fundsPercent,
        initiatorPercent: settings.initiatorPercent,
      };
      periods.push({
        id: periods.length + 1,
        braname: data.braname,
        period: data.period,
        facts,
        totals: Model.closePeriod(facts),
        initiator: settings.initiator.get(data.braname) ?? `chair.${data.braname}`,
      });
      return {};
    },

    async listBranchPeriods(_coopname: string, braname: string) {
      return periods.filter((p) => p.braname === braname).map(periodRowOf);
    },

    /** Кошелёк пайщика в цепи; тест читает только кошелёк обеспечительной части к списанию. */
    async getUserWallet(_coopname: string, walletName: string, username: string) {
      calls.getUserWallet.push({ walletName, username });
      const fault = faults.walletRead.shift();
      if (fault) throw fault;
      if (walletName !== 'w.mkt.due' || !wallets.due.has(username)) return null;
      return { id: 0, wallet_name: walletName, username, available: toAsset(wallets.due.get(username) ?? 0n), blocked: toAsset(0n) };
    },

    async deletePeriod(data: any) {
      calls.deletePeriod.push(data);
      const index = periods.findIndex((p) => p.braname === data.braname && p.period === data.period);
      if (index < 0) throw refusal('MARKETPLACE_PERIOD_NOT_CLOSED', 'Итог участка за период не рассчитан');
      periods.splice(index, 1);
      return {};
    },

    async chargePeriod(data: any) {
      calls.chargePeriod.push(data);
      const fault = faults.chargePeriod.get(data.order_hash)?.shift();
      if (fault) throw fault;
      const amount = toUnits(data.amount);
      const base = toUnits(data.base);
      if (amount <= 0n || base <= 0n) throw refusal('MARKETPLACE_DUE_AMOUNT_INVALID', 'Сумма списания и стоимость заказа должны быть больше нуля');
      const period = periods.find((p) => p.braname === data.braname && p.period === data.period);
      if (!period) throw refusal('MARKETPLACE_PERIOD_NOT_CLOSED', 'Итог участка за период не рассчитан');
      const available = wallets.due.get(data.username) ?? 0n;
      if (available < amount) throw refusal('MARKETPLACE_DUE_EXCEEDS', `заявлено ${toAsset(amount)}, доступно ${toAsset(available)}`);

      const parts = Model.chargeOrder(period.totals, amount, base);
      add(wallets.due, data.username, -amount);
      add(wallets.branch, data.braname, parts.branch);
      wallets.funds += parts.funds;
      const inv = invest.get(data.braname);
      if (inv && inv.base > 0n) {
        // Как route_initiator_share: доля инициаторов возмещает паевые взносы, сверх остатка — участку.
        const route = Model.crpsRoute(inv, parts.initiator);
        inv.acc = route.acc;
        inv.repaid += route.repay;
        add(wallets.repay, data.braname, route.repay);
        add(wallets.branch, data.braname, route.toBranch);
      } else {
        add(wallets.invest, period.initiator, parts.initiator);
      }
      add(wallets.share, data.username, parts.returned);

      if (faults.lostEvents.has(data.order_hash)) return {};
      const ops: AppliedOp[] = [];
      if (parts.charged > 0n) ops.push({ code: MarketplaceSecureDueOperation.CHARGE, units: parts.charged, username: data.username, hash: data.order_hash, at: clock });
      if (parts.returned > 0n) ops.push({ code: MarketplaceSecureDueOperation.RETURN_DUE, units: parts.returned, username: data.username, hash: data.order_hash, at: clock });
      await deliver(ops);
      return {};
    },

    async chargeDue(data: any) {
      calls.chargeDue.push(data);
      const amount = toUnits(data.amount);
      const available = wallets.due.get(data.username) ?? 0n;
      if (available < amount) throw refusal('MARKETPLACE_DUE_EXCEEDS', `заявлено ${toAsset(amount)}, доступно ${toAsset(available)}`);
      add(wallets.due, data.username, -amount);
      add(wallets.branch, data.braname, amount);
      await deliver([{ code: MarketplaceSecureDueOperation.CHARGE, units: amount, username: data.username, hash: data.order_hash, at: clock }]);
      return {};
    },
  };

  // ── Соседи сервисов ───────────────────────────────────────────────────
  const economy = { assetToUnits: (v: string) => toUnits(v), unitsToAsset: (u: bigint) => toAsset(u) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() };
  const notifications = { notifyUser: jest.fn(async (..._args: any[]) => undefined) };
  const accountPort = { getDisplayName: async (username: string) => `Имя ${username}` };
  const orderRepo = {
    findByOrderHash: async (_coop: string, hash: string) => {
      const order = orders.get(hash.toLowerCase());
      return order ? { order_hash: order.hash, delivery_braname: order.braname, warranty_until: order.warrantyUntil ?? null } : null;
    },
  };
  const claimRepo = {
    findByRequestHash: async () => null,
    listActiveOrderHashes: async () => [...settings.openClaims],
    findActiveByOrderId: async () => null,
  };
  const expenseChassis = {
    listPlans: async (_coop: string, braname: string) => {
      const fault = faults.plans.shift();
      if (fault) throw fault;
      return settings.plans.filter((p) => p.branchName === braname);
    },
  };
  const ledger2History = {
    getHistory: async (filter: { username?: string; operationCodes?: string[]; dateFrom?: Date; dateTo?: Date }) => {
      const items = settings.ledger
        .filter((op) => op.username === filter.username && (filter.operationCodes ?? []).includes(op.operationCode))
        .filter((op) => (!filter.dateFrom || op.createdAt >= filter.dateFrom) && (!filter.dateTo || op.createdAt < filter.dateTo));
      return { items, totalCount: items.length, totalPages: 1, currentPage: 1 };
    },
  };
  const aidMirror = {
    paidWithin: async (_coop: string, braname: string, from: Date) => {
      // Начало месяца по Москве: спустя сутки календарная дата уже внутри этого месяца.
      const inside = new Date(from.getTime() + 24 * 60 * 60 * 1000);
      return settings.aidPaid.get(`${braname}/${periodOf(inside.getUTCFullYear(), inside.getUTCMonth() + 1)}`) ?? 0n;
    },
    isAidHash: async (_coop: string, hash: string) => settings.aidHashes.has(hash),
  };

  const periodService = new MarketplacePeriodService(
    periodStore as never,
    chainPort as never,
    expenseChassis as never,
    ledger2History as never,
    economy as never,
    aidMirror as never,
    logger as never
  );
  const dueService: MarketplaceSecureDueService = new MarketplaceSecureDueService(
    dueStore as never,
    orderRepo as never,
    claimRepo as never,
    chainPort as never,
    economy as never,
    accountPort as never,
    notifications as never,
    logger as never,
    periodService,
    runQueriesOver(dueStore) as never,
    { emit: jest.fn() } as never
  );

  return {
    dueService,
    periodService,
    dueStore,
    periodStore,
    wallets,
    periods,
    settings,
    faults,
    calls,
    logger,
    notifications,

    /** Выдача заказа: стоимость и обеспечительная часть одной транзакцией, как в цепи. */
    async issue(order: IssuedOrder): Promise<void> {
      orders.set(order.hash, order);
      add(wallets.due, order.username, order.due);
      await deliver([
        { code: MarketplaceSecureDueOperation.CONSUM, units: order.base, username: order.username, hash: order.hash, at: order.issuedAt },
        { code: MarketplaceSecureDueOperation.TO_DUE, units: order.due, username: order.username, hash: order.hash, at: order.issuedAt },
      ]);
    },

    /** Удержание при отказе от получения: стоимости нет, сумма ложится к списанию сразу. */
    async penalize(order: Omit<IssuedOrder, 'base'>): Promise<void> {
      orders.set(order.hash, { ...order, base: 0n });
      add(wallets.due, order.username, order.due);
      await deliver([{ code: MarketplaceSecureDueOperation.PENALTY, units: order.due, username: order.username, hash: order.hash, at: order.issuedAt }]);
    },

    /** Паевые взносы инициаторов участка: имущество по цене приёма сразу в базе возврата. */
    investProperty(braname: string, units: bigint): void {
      const b = invest.get(braname) ?? { base: 0n, acc: 0n, sJoin: 0n, sFixed: 0n, unusedTotal: 0n, reserved: 0n, property: 0n, repaid: 0n };
      b.base += units;
      b.sJoin += units * b.acc;
      b.property += units;
      invest.set(braname, b);
    },

    /** Остаток к возврату инициаторам участка по формуле контракта. */
    investOutstanding(braname: string): bigint {
      const b = invest.get(braname);
      return b ? Model.crpsOutstanding(b) : 0n;
    },

    investRepaid(braname: string): bigint {
      return invest.get(braname)?.repaid ?? 0n;
    },

    /** Проход крона в заданный момент. */
    async run(now: Date): Promise<{ charged: number; failed: number }> {
      clock = now;
      return dueService.chargeDue(COOP, now);
    },

    chainPeriod(braname: string, period: number): ChainPeriod | undefined {
      return periods.find((p) => p.braname === braname && p.period === period);
    },

    dueRow(hash: string): MarketplaceSecureDueEntity | undefined {
      return dueStore.rows.get(hash);
    },
  };
}

export type KeuWorld = ReturnType<typeof createKeuWorld>;
