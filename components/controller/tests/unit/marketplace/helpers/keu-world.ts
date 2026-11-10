/**
 * Мир для тестов цикла коэффициента экономического участия: настоящие сервисы
 * ИСТОКА (зеркало обеспечительной части, прогон по окончании периода, итог
 * периода) поверх подставной цепи и таблиц в памяти.
 *
 * Подставная цепь ведёт счётчики списания так же, как контракт (задача
 * 99D-33): выдача пополняет строку пайщика `kudues` и строку участка
 * `kucounters` за период конца гарантийного срока, удержание при отказе —
 * текущего периода; `closeperiod` берёт T и C из счётчика участка и стирает
 * его, `chargeperiod` делит строку пайщика по ставкам итога эталоном
 * `MarketContract.PeriodModel` и стирает её. Периоды — календарные месяцы UTC,
 * как у контракта без длины периода стенда. Цепь ведёт кошельки, отвечает
 * отказами с кодами контракта и отдаёт операции ledger2 слушателю разом, без
 * ожидания между ними, — как их выпускает шина событий узла.
 */
import { MarketContract } from 'cooptypes';
import { memoryTable, toAsset, toUnits } from './memory-table';
import {
  MarketplaceSecureDueOperation,
  MarketplaceSecureDueService,
  chargeHashOf,
} from '~/extensions/marketplace/application/services/marketplace-secure-due.service';
import { MarketplacePeriodService } from '~/extensions/marketplace/application/services/marketplace-period.service';
import type { MarketplaceSecureDueEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-secure-due.entity';
import type { MarketplaceBranchPeriodEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-branch-period.entity';

const Model = MarketContract.PeriodModel;

export { toAsset, toUnits };

export const COOP = 'voskhod';
export const TIMEZONE = 'Europe/Moscow';

/** Рубли в единицы актива: четыре знака. */
export const rub = (value: number): bigint => BigInt(Math.round(value * 10_000));

/**
 * 00:30 UTC первого числа месяца (03:30 по Москве) — первый проход крона в
 * новом периоде: контракт нумерует периоды по UTC, и до полуночи UTC период
 * ещё идёт.
 */
export function firstOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 0, 30));
}

/** Полдень заданного дня по Москве. */
export function dayOf(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 9, 0));
}

/** Номер периода, как его считает контракт без длины периода стенда: год × 12 + месяц по UTC. */
export const periodOf = (year: number, month: number): number => year * 12 + month;

/** Период момента — тот же расчёт, что у контракта (`Branch::aid_period` при нулевой длине). */
export const periodOfDate = (at: Date): number => at.getUTCFullYear() * 12 + at.getUTCMonth() + 1;

/** Отказ контракта в том виде, в каком его отдаёт цепь. */
function refusal(code: string, text: string): Error {
  return new Error(`assertion failure with message: ${code}: ${text}`);
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

/** Строка счётчика пайщика за период (`kudues`). */
export interface ChainDue {
  username: string;
  braname: string;
  period: number;
  turnover: bigint;
  due: bigint;
  retained: bigint;
  orders: number;
}

/** Строка счётчика участка за период (`kucounters`). */
interface ChainCounter {
  braname: string;
  period: number;
  turnover: bigint;
  secured: bigint;
  retained: bigint;
  orders: number;
  members: number;
}

interface AppliedOp {
  code: MarketplaceSecureDueOperation;
  units: bigint;
  username: string;
  hash: string;
  at: Date;
}

const dueKey = (username: string, braname: string, period: number) => `${username}/${braname}/${period}`;
const counterKey = (braname: string, period: number) => `${braname}/${period}`;

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
  const dues = new Map<string, ChainDue>();
  const counters = new Map<string, ChainCounter>();
  const orders = new Map<string, IssuedOrder>();
  /** Операции нитки списания — история ledger2 по хэшу процесса. */
  const chargeLog: Array<{ processHash: string; operationCode: string; quantity: string }> = [];
  const settings = {
    fundsPercent: 210_000n,
    initiatorPercent: 618_000n,
    /** Резерв социально-экономического обеспечения участка. */
    reserve: new Map<string, bigint>(),
    /** Плановые расходы участков: запись реестра планов со сроком. */
    plans: [] as Array<{ branchName: string; dueDate: Date; amount: string; proposalHash?: string; paidAt?: Date }>,
    /** Материальная помощь, выплаченная участком за месяц: участок/номер месяца → сумма. */
    aidPaid: new Map<string, bigint>(),
    initiator: new Map<string, string>(),
    /** Открытые заявления на гарантийный возврат — по хэшу заказа; контракт по ним отказывает в списании пайщику. */
    openClaims: new Set<string>(),
    /** Журнал учёта участков для фактов месяца: служебные записки (o.brn.expfnd, o.mkt.ipool и возвраты). */
    ledger: [] as Array<{ operationCode: string; username: string; quantity: string; processHash: string; createdAt: Date }>,
    /** Хэши заявлений на материальную помощь: их выделение из средств инициаторов — не записка. */
    aidHashes: new Set<string>(),
  };
  const faults = {
    /** Очередь сбоев расчёта итога месяца: каждый вызов забирает один. */
    closePeriod: [] as Error[],
    /** Сбои списания строки по имени пайщика. */
    chargePeriod: new Map<string, Error[]>(),
    /** Операции списания этих пайщиков до слушателя не доходят — сбой учёта зеркала. */
    lostEvents: new Set<string>(),
    /** Очередь сбоев чтения реестра плановых расходов: факты месяца не собраны. */
    plans: [] as Error[],
  };
  const calls = {
    closePeriod: [] as any[],
    chargePeriod: [] as any[],
    deletePeriod: [] as any[],
    migrateDue: [] as any[],
  };
  let sequence = 1;
  let clock = new Date('2027-01-01T00:00:00.000Z');
  const currentPeriod = () => periodOfDate(clock);

  // ── Счётчики, как их ведёт контракт ───────────────────────────────────
  function ensureCounter(braname: string, period: number): ChainCounter {
    const key = counterKey(braname, period);
    let c = counters.get(key);
    if (!c) {
      c = { braname, period, turnover: 0n, secured: 0n, retained: 0n, orders: 0, members: 0 };
      counters.set(key, c);
    }
    return c;
  }
  function ensureDue(username: string, braname: string, period: number): ChainDue {
    const key = dueKey(username, braname, period);
    let d = dues.get(key);
    if (!d) {
      d = { username, braname, period, turnover: 0n, due: 0n, retained: 0n, orders: 0 };
      dues.set(key, d);
      const c = counters.get(counterKey(braname, period));
      if (c) c.members += 1;
    }
    return d;
  }
  /** Как контракт: строку держит только возврат по заказу этой строки — тот же пайщик, участок и период гарантии. */
  const hasOpenClaim = (username: string, braname: string, period: number) =>
    [...settings.openClaims].some((hash) => {
      const o = orders.get(hash);
      return o?.username === username && o.braname === braname && periodOfDate(o.warrantyUntil ?? o.issuedAt) === period;
    });

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
    // Поля цели резерва (задача 99D-34) — только у итога, посчитанного новым узлом.
    ...(p.facts.plannedTarget !== undefined
      ? {
          planned_target: toAsset(p.facts.plannedTarget),
          target: toAsset(p.totals.target),
          target_prev: toAsset(p.facts.fundedPrev ?? 0n),
          target_funded: toAsset(p.totals.funded),
        }
      : {}),
  });
  const dueRowOf = (d: ChainDue) => ({
    id: 0,
    username: d.username,
    braname: d.braname,
    period: d.period,
    turnover: toAsset(d.turnover),
    due: toAsset(d.due),
    retained: toAsset(d.retained),
    orders: d.orders,
  });

  const chainPort = {
    /** Настроек участков нет — период списания равен календарному месяцу UTC. */
    async getBranchConfig() {
      return null;
    },
    async hasAnyDues() {
      return dues.size > 0;
    },
    async listDueCounters() {
      return [...counters.values()].map((c) => ({
        id: 0,
        braname: c.braname,
        period: c.period,
        turnover: toAsset(c.turnover),
        secured: toAsset(c.secured),
        retained: toAsset(c.retained),
        orders: c.orders,
        members: c.members,
      }));
    },
    async listBranchDues(_coopname: string, braname: string) {
      return [...dues.values()].filter((d) => d.braname === braname).map(dueRowOf);
    },
    async listMemberDues(_coopname: string, username: string) {
      return [...dues.values()].filter((d) => d.username === username).map(dueRowOf);
    },
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

    /**
     * `closeperiod`: T и C из счётчика участка, от узла — факты о расходах и
     * цель плановых расходов (задача 99D-34). Право получателей помощи
     * подставная цепь считает взятым целиком каждый месяц: цель помощи —
     * сумма строки резерва участка. Месяц без счётчика — нули.
     */
    async closePeriod(data: any) {
      calls.closePeriod.push(data);
      const fault = faults.closePeriod.shift();
      if (fault) throw fault;
      if (!(data.period < currentPeriod())) throw refusal('MARKETPLACE_PERIOD_OPEN', 'Период списания ещё идёт');
      if (periods.some((p) => p.braname === data.braname && p.period === data.period)) {
        throw refusal('MARKETPLACE_PERIOD_EXISTS', 'Итог участка за период уже рассчитан');
      }
      const byTarget = data.planned_target !== undefined;
      const counter = counters.get(counterKey(data.braname, data.period));
      if (!byTarget && (!counter || counter.turnover <= 0n)) throw refusal('MARKETPLACE_PERIOD_EMPTY', 'За период на участке нет выданных заказов с обеспечительной частью');
      const earlier = periods.filter((p) => p.braname === data.braname && p.period < data.period);
      const prev = earlier.sort((a, b) => b.period - a.period)[0];
      const facts = {
        turnover: counter?.turnover ?? 0n,
        secured: counter?.secured ?? 0n,
        planned: toUnits(data.planned),
        memos: toUnits(data.memos),
        aidPaid: toUnits(data.aid_paid),
        reserve: settings.reserve.get(data.braname) ?? 0n,
        reservePrev: prev ? prev.facts.reserve : 0n,
        fundsPercent: settings.fundsPercent,
        initiatorPercent: settings.initiatorPercent,
        ...(byTarget
          ? { plannedTarget: toUnits(data.planned_target), fundedPrev: prev ? (prev.facts.plannedTarget !== undefined ? prev.totals.funded : prev.facts.reserve) : 0n }
          : {}),
      };
      periods.push({
        id: periods.length + 1,
        braname: data.braname,
        period: data.period,
        facts,
        totals: Model.closePeriod(facts),
        initiator: settings.initiator.get(data.braname) ?? `chair.${data.braname}`,
      });
      counters.delete(counterKey(data.braname, data.period));
      return {};
    },

    async listBranchPeriods(_coopname: string, braname: string) {
      return periods.filter((p) => p.braname === braname).map(periodRowOf);
    },
    async listAllBranchPeriods() {
      return periods.map(periodRowOf);
    },
    /** Строки резерва помощи: по строке председателя на участок с резервом. */
    async listBranchReserves(_coopname: string, braname: string) {
      const amount = settings.reserve.get(braname);
      return amount ? [{ id: 1, braname, username: `chair.${braname}`, amount: toAsset(amount) }] : [];
    },
    async listAllBranchReserves() {
      return [...settings.reserve.entries()].filter(([, amount]) => amount > 0n).map(([braname, amount], i) => ({ id: i + 1, braname, username: `chair.${braname}`, amount: toAsset(amount) }));
    },

    /** Кошелёк пайщика в цепи; тест читает только кошелёк обеспечительной части к списанию. */
    async getUserWallet(_coopname: string, walletName: string, username: string) {
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

    /** `chargeperiod`: строка пайщика делится по ставкам итога и стирается; суммы — из счётчика. */
    async chargePeriod(data: any) {
      calls.chargePeriod.push(data);
      const fault = faults.chargePeriod.get(data.username)?.shift();
      if (fault) throw fault;
      const key = dueKey(data.username, data.braname, data.period);
      const row = dues.get(key);
      if (!row) throw refusal('MARKETPLACE_DUE_NOT_FOUND', 'У пайщика нет обеспечительной части к списанию за этот период');
      if (!(data.period < currentPeriod())) throw refusal('MARKETPLACE_PERIOD_OPEN', 'Период списания ещё идёт');
      if (hasOpenClaim(data.username, data.braname, data.period)) throw refusal('MARKETPLACE_DUE_RETURN_PENDING', 'По заказу этого периода открыто заявление на гарантийный возврат');
      const period = periods.find((p) => p.braname === data.braname && p.period === data.period);
      if (row.turnover > 0n && !period) throw refusal('MARKETPLACE_PERIOD_NOT_CLOSED', 'Итог участка за период не рассчитан');
      const total = row.due + row.retained;
      const available = wallets.due.get(data.username) ?? 0n;
      if (available < total) throw refusal('MARKETPLACE_DUE_EXCEEDS', `учтено ${toAsset(total)}, доступно ${toAsset(available)}`);

      const rates = period?.totals ?? { rateBranch: 0n, rateFunds: 0n, rateInitiator: 0n };
      const parts = Model.chargeRow(rates, row.due, row.turnover, row.retained);
      add(wallets.due, data.username, -total);
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
      } else if (period) {
        add(wallets.invest, period.initiator, parts.initiator);
      }
      add(wallets.share, data.username, parts.returned);
      dues.delete(key);

      const hash = chargeHashOf(COOP, data.username, data.braname, data.period);
      const ops: AppliedOp[] = [];
      if (parts.charged > 0n) ops.push({ code: MarketplaceSecureDueOperation.CHARGE, units: parts.charged, username: data.username, hash, at: clock });
      if (parts.returned > 0n) ops.push({ code: MarketplaceSecureDueOperation.RETURN_DUE, units: parts.returned, username: data.username, hash, at: clock });
      for (const op of ops) chargeLog.push({ processHash: hash, operationCode: op.code, quantity: toAsset(op.units) });
      if (faults.lostEvents.has(data.username)) return {};
      await deliver(ops);
      return {};
    },

    /** Переходный перенос строки зеркала в счётчики — под потолком кошелька пайщика. */
    async migrateDue(data: any) {
      calls.migrateDue.push(data);
      const due = toUnits(data.due);
      const retained = toUnits(data.retained);
      const turnover = toUnits(data.turnover);
      const already = [...dues.values()].filter((d) => d.username === data.username).reduce((s, d) => s + d.due + d.retained, 0n);
      const available = wallets.due.get(data.username) ?? 0n;
      if (available < already + due + retained) throw refusal('MARKETPLACE_DUE_EXCEEDS', 'Перенос превышает остаток кошелька обеспечительной части');
      if (!periods.some((p) => p.braname === data.braname && p.period === data.period)) {
        const c = ensureCounter(data.braname, data.period);
        c.turnover += turnover;
        c.secured += due;
        c.retained += retained;
        if (turnover > 0n) c.orders += 1;
      }
      const d = ensureDue(data.username, data.braname, data.period);
      d.turnover += turnover;
      d.due += due;
      d.retained += retained;
      if (turnover > 0n) d.orders += 1;
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
    getHistory: async (filter: { username?: string; processHash?: string; operationCodes?: string[]; dateFrom?: Date; dateTo?: Date }) => {
      if (filter.processHash) {
        const items = chargeLog.filter((op) => op.processHash === filter.processHash && (filter.operationCodes ?? []).includes(op.operationCode));
        return { items, totalCount: items.length, totalPages: 1, currentPage: 1 };
      }
      const items = settings.ledger
        .filter((op) => op.username === filter.username && (filter.operationCodes ?? []).includes(op.operationCode))
        .filter((op) => (!filter.dateFrom || op.createdAt >= filter.dateFrom) && (!filter.dateTo || op.createdAt < filter.dateTo));
      return { items, totalCount: items.length, totalPages: 1, currentPage: 1 };
    },
  };
  const aidMirror = {
    paidRowsWithin: async (_coop: string, braname: string, from: Date) => {
      // Начало месяца по Москве: спустя сутки календарная дата уже внутри этого месяца.
      const inside = new Date(from.getTime() + 24 * 60 * 60 * 1000);
      const key = `${braname}/${periodOf(inside.getUTCFullYear(), inside.getUTCMonth() + 1)}`;
      const amount = settings.aidPaid.get(key) ?? 0n;
      return amount > 0n ? [{ hash: `aid:${key}`, amount }] : [];
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
    ledger2History as never,
    logger as never,
    periodService,
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

    /**
     * Выдача заказа: кошелёк, счётчики периода конца гарантийного срока (без
     * гарантии — периода выдачи) и операции ledger2 одной транзакцией, как в цепи.
     */
    async issue(order: IssuedOrder): Promise<void> {
      orders.set(order.hash, order);
      add(wallets.due, order.username, order.due);
      const period = periodOfDate(order.warrantyUntil ?? order.issuedAt);
      const c = ensureCounter(order.braname, period);
      const d = ensureDue(order.username, order.braname, period);
      d.turnover += order.base;
      d.due += order.due;
      d.orders += 1;
      c.turnover += order.base;
      c.secured += order.due;
      c.orders += 1;
      await deliver([
        { code: MarketplaceSecureDueOperation.CONSUM, units: order.base, username: order.username, hash: order.hash, at: order.issuedAt },
        { code: MarketplaceSecureDueOperation.TO_DUE, units: order.due, username: order.username, hash: order.hash, at: order.issuedAt },
      ]);
    },

    /** Удержание при отказе от получения: стоимости нет, сумма встаёт в счётчик текущего периода. */
    async penalize(order: Omit<IssuedOrder, 'base'>): Promise<void> {
      orders.set(order.hash, { ...order, base: 0n });
      add(wallets.due, order.username, order.due);
      const period = periodOfDate(order.issuedAt);
      const c = ensureCounter(order.braname, period);
      const d = ensureDue(order.username, order.braname, period);
      d.retained += order.due;
      c.retained += order.due;
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

    /** Переходный перенос зеркала в счётчики — при старте узла. */
    async migrate(): Promise<{ moved: number; failed: number }> {
      return dueService.migrateMirror();
    },

    chainPeriod(braname: string, period: number): ChainPeriod | undefined {
      return periods.find((p) => p.braname === braname && p.period === period);
    },

    /** Строка счётчика пайщика в цепи; нет — списана либо не заводилась. */
    chainDue(username: string, braname: string, period: number): ChainDue | undefined {
      return dues.get(dueKey(username, braname, period));
    },

    /** Счётчик участка в цепи; нет — итог рассчитан либо заказов не было. */
    chainCounter(braname: string, period: number): ChainCounter | undefined {
      return counters.get(counterKey(braname, period));
    },

    dueRow(hash: string): MarketplaceSecureDueEntity | undefined {
      return dueStore.rows.get(hash);
    },

    /** Положить строку в зеркало без цепи — заказ, выданный до появления счётчиков. */
    seedMirrorRow(row: Partial<MarketplaceSecureDueEntity> & { order_hash: string }): void {
      dueStore.rows.set(row.order_hash, {
        coopname: COOP,
        username: 'anna',
        braname: 'branch1',
        due_amount: '0.0000',
        charged_amount: '0.0000',
        base_amount: '0.0000',
        returned_amount: '0.0000',
        due_from: null,
        charged_at: null,
        run_period: null,
        charge_sent_at: null,
        last_sequence: '0',
        created_at: new Date('2027-01-01T00:00:00.000Z'),
        updated_at: new Date('2027-01-01T00:00:00.000Z'),
        ...row,
      } as MarketplaceSecureDueEntity);
    },

    /** Остаток кошелька пайщика к списанию в цепи — для переходного переноса. */
    fundDueWallet(username: string, units: bigint): void {
      add(wallets.due, username, units);
    },
  };
}

export type KeuWorld = ReturnType<typeof createKeuWorld>;
