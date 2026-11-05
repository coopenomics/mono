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
import { MarketplaceSecureDueOperation, MarketplaceSecureDueService } from '~/extensions/marketplace/application/services/marketplace-secure-due.service';
import { MarketplacePeriodService } from '~/extensions/marketplace/application/services/marketplace-period.service';
import type { MarketplaceSecureDueEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-secure-due.entity';
import type { MarketplaceBranchPeriodEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-branch-period.entity';

const Model = MarketContract.PeriodModel;

export const COOP = 'voskhod';
export const TIMEZONE = 'Europe/Moscow';

/** Рубли в единицы актива: четыре знака. */
export const rub = (value: number): bigint => BigInt(Math.round(value * 10_000));

export function toUnits(value: unknown): bigint {
  const [int = '0', frac = ''] = (String(value ?? '0').trim().split(/\s+/)[0] ?? '0').split('.');
  return BigInt(int) * 10_000n + BigInt((frac + '0000').slice(0, 4));
}

export function toAsset(units: bigint): string {
  const padded = units.toString().padStart(5, '0');
  return `${padded.slice(0, -4)}.${padded.slice(-4)} RUB`;
}

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

type Where = Record<string, any>;

function matches(row: any, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && 'operator' in expected) {
      if (expected.operator === 'is null') return row[key] == null;
      if (expected.operator === '<=') return row[key] != null && row[key] <= expected.value;
      throw new Error(`условие ${expected.operator} в таблице теста не описано`);
    }
    return row[key] === expected;
  });
}

/**
 * Таблица в памяти с поведением шлюза базы: первичный ключ уникален (повторная
 * вставка падает, как в PostgreSQL), каждый запрос уступает очередь событий,
 * отбор понимает порядок и предел.
 */
function memoryTable<T extends object>(keyOf: (row: any) => string) {
  const rows = new Map<string, T>();
  const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
  const select = (where: Where, options: { order?: Record<string, 'ASC' | 'DESC'>; limit?: number; offset?: number } = {}) => {
    let list = [...rows.values()].filter((row) => matches(row, where));
    for (const [field, direction] of Object.entries(options.order ?? {})) {
      list = list.sort((a: any, b: any) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (direction === 'DESC' ? -1 : 1));
    }
    const offset = options.offset ?? 0;
    return list.slice(offset, options.limit === undefined ? undefined : offset + options.limit);
  };
  const table = {
    rows,
    /** Следующая вставка упадёт с этой ошибкой — сбой базы. */
    failNextInsert: null as Error | null,
    async findOne(where: Where): Promise<T | null> {
      await yieldTurn();
      return select(where)[0] ?? null;
    },
    async find(where: Where, options?: any): Promise<T[]> {
      await yieldTurn();
      return select(where, options);
    },
    async findAndCount(where: Where, options?: any): Promise<[T[], number]> {
      await yieldTurn();
      return [select(where, options), select(where).length];
    },
    async insert(fields: any): Promise<T> {
      await yieldTurn();
      if (table.failNextInsert) {
        const error = table.failNextInsert;
        table.failNextInsert = null;
        throw error;
      }
      const key = keyOf(fields);
      if (rows.has(key)) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      const row = { created_at: new Date(), updated_at: new Date(), ...fields } as T;
      rows.set(key, row);
      return row;
    },
    async update(where: Where, patch: any): Promise<number> {
      await yieldTurn();
      const key = keyOf(where);
      const row = rows.get(key);
      if (!row) return 0;
      rows.set(key, { ...row, ...patch });
      return 1;
    },
  };
  return table;
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
    funds: 0n,
  };
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
  };
  const calls = {
    closePeriod: [] as any[],
    chargePeriod: [] as any[],
    chargeDue: [] as any[],
    deletePeriod: [] as any[],
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

    async listPeriods() {
      return periods.map(periodRowOf);
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
      add(wallets.invest, period.initiator, parts.initiator);
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
    listByStatus: async () => [...settings.openClaims].map((order_hash) => ({ order_hash })),
    findActiveByOrderId: async () => null,
  };
  const expenseChassis = {
    listPlans: async (_coop: string, braname: string) => {
      const fault = faults.plans.shift();
      if (fault) throw fault;
      return settings.plans.filter((p) => p.branchName === braname);
    },
  };
  const ledger2History = { getHistory: async () => ({ items: [], totalCount: 0, totalPages: 1, currentPage: 1 }) };
  const aidMirror = {
    paidWithin: async (_coop: string, braname: string, from: Date) => {
      // Начало месяца по Москве: спустя сутки календарная дата уже внутри этого месяца.
      const inside = new Date(from.getTime() + 24 * 60 * 60 * 1000);
      return settings.aidPaid.get(`${braname}/${periodOf(inside.getUTCFullYear(), inside.getUTCMonth() + 1)}`) ?? 0n;
    },
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
    periodService
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
