/**
 * Обеспечительная часть паевого взноса к списанию (задачи 99D-18, 99D-33).
 *
 * Зеркало узла ведётся по операциям ledger2, которые провёл контракт: к
 * списанию (o.mkt.todue, o.mkt.penal), гарантийный возврат (o.mkt.undue),
 * списание строки счётчика пайщика (o.mkt.charge, o.mkt.retdue — нитка
 * p.mkt.due) и выход пайщика (o.mkt.exfee). Прогон по окончании периода идёт
 * по счётчикам цепи: итог участка — по его счётчику, списание — по строке
 * пайщика, суммы в цепь не передаются; письмо пайщику — одно за прогон и
 * только если что-то списано.
 *
 * Реестр: mkt.secure.due.side.1–9, mkt.order.keu.12–15.
 */
jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return {
    ...actual,
    platformSettings: () => ({ coopname: 'voskhod', timezone: 'Europe/Moscow', frontendUrl: 'https://coop.test' }),
  };
});

import { AmountFormatterUtils } from '@coopenomics/extension-kit';
import {
  MarketplaceSecureDueOperation,
  MarketplaceSecureDueService,
  chargeHashOf,
  monthKey,
} from '~/extensions/marketplace/application/services/marketplace-secure-due.service';
import type { MarketplaceSecureDueEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-secure-due.entity';
import { memoryTable, toAsset, toUnits } from './helpers/memory-table';
import { useRealCalendar } from './helpers/real-calendar';

const COOP = 'voskhod';
const BRANCH = 'branch1';
const USER = 'orderer1';

useRealCalendar();
const ORDER = 'a'.repeat(64);
const ORDER_2 = 'b'.repeat(64);
const OCTOBER = 2026 * 12 + 10;
const NOVEMBER = 2026 * 12 + 11;

/** Строка счётчика пайщика в подставной цепи. */
interface ChainDue {
  username: string;
  braname: string;
  period: number;
  turnover: bigint;
  due: bigint;
  retained: bigint;
  orders: number;
}

function build(opts: { warrantyUntil?: Date | null; openClaim?: boolean; mirroredPeriod?: number } = {}) {
  const store = memoryTable<MarketplaceSecureDueEntity>((row) => row.order_hash);
  const orderRepo = {
    findByOrderHash: jest.fn(async (_c: string, hash: string) => ({
      order_hash: hash,
      delivery_braname: BRANCH,
      warranty_until: opts.warrantyUntil ?? null,
    })),
  };
  const claimRepo = {
    findByRequestHash: jest.fn(async (_c: string, hash: string) => (hash === 'c'.repeat(64) ? { order_hash: ORDER.toUpperCase() } : null)),
    // Открытой претензии по заказу нет: карточка заказа читает коэффициент экономического участия без гарантийного спора.
    findActiveByOrderId: jest.fn(async () => null),
  };
  const economy = { assetToUnits: (v: string) => toUnits(v), unitsToAsset: (u: bigint) => toAsset(u) };
  // Итог периода и ставки (задача 99D-22): ставки участка Б из документа модели.
  const periodRow = {
    coopname: COOP, braname: BRANCH, period: 0,
    rate_branch: '166666', rate_funds: '44303', rate_initiator: '104460',
    rows_total: 0, rows_charged: 0, deleted_at: null,
  };
  const closed = new Set<number>(opts.mirroredPeriod === undefined ? [] : [opts.mirroredPeriod]);
  const periodService = {
    adoptClosed: jest.fn(async (_c: string, _b: string, period: number) => (closed.has(period) ? { ...periodRow, period } : null)),
    pruneOld: jest.fn(async () => undefined),
    ensureClosed: jest.fn(async (_c: string, _b: string, period: number, rows: number) => {
      closed.add(period);
      return { ...periodRow, period, rows_total: rows };
    }),
    noteCharged: jest.fn(async () => undefined),
    ratePercentOf: jest.fn(() => '31.54'),
    findOne: jest.fn(async (_c: string, _b: string, period: number) => (closed.has(period) ? { ...periodRow, period } : null)),
    // Итог месяца без выданных заказов (задача 99D-34): участки-кандидаты задаёт тест.
    quietCandidates: jest.fn(async (): Promise<string[]> => []),
    ensureQuietClosed: jest.fn(async () => null),
  };

  // ── Подставная цепь: счётчики и списание ──
  const dues: ChainDue[] = [];
  const counters = new Map<string, { braname: string; period: number; turnover: bigint; secured: bigint; retained: bigint; orders: number; members: number }>();
  /** Операции нитки списания — для истории по хэшу процесса. */
  const chargeLog: Array<{ processHash: string; operationCode: string; quantity: string }> = [];
  const rowOf = (d: ChainDue) => ({ id: 0, ...d, turnover: toAsset(d.turnover), due: toAsset(d.due), retained: toAsset(d.retained) });
  const chainPort = {
    getBranchConfig: jest.fn(async () => null),
    hasAnyDues: jest.fn(async () => dues.length > 0),
    // Итоги участков в цепи: подставная цепь итоги не хранит — ставки живут в заглушке сервиса итога.
    listAllBranchPeriods: jest.fn(async () => [...closed].map((period) => ({ braname: BRANCH, period }))),
    listDueCounters: jest.fn(async () =>
      [...counters.values()].map((c) => ({ id: 0, ...c, turnover: toAsset(c.turnover), secured: toAsset(c.secured), retained: toAsset(c.retained) }))
    ),
    listBranchDues: jest.fn(async (_c: string, braname: string) => dues.filter((d) => d.braname === braname).map(rowOf)),
    listMemberDues: jest.fn(async (_c: string, username: string) => dues.filter((d) => d.username === username).map(rowOf)),
    // Паевых взносов инициаторов у участка нет (задача 99D-30): возмещения при списании нет.
    getInvestBranch: jest.fn(async () => null),
    migrateDue: jest.fn(async () => ({})),
    /**
     * Списание строки по ставкам участка Б: как на стенде, строки зеркала
     * обновляет слушатель до возврата транзакции — здесь операции нитки
     * списания отдаются слушателю заглушкой цепи.
     */
    chargePeriod: jest.fn(async (data: { username: string; braname: string; period: number }) => {
      const index = dues.findIndex((d) => d.username === data.username && d.braname === data.braname && d.period === data.period);
      if (index < 0) throw new Error('assertion failure with message: MARKETPLACE_DUE_NOT_FOUND: строки нет');
      if (opts.openClaim) throw new Error('assertion failure with message: MARKETPLACE_DUE_RETURN_PENDING: открыт возврат');
      const row = dues[index];
      const part = (rate: string) => (row.turnover * BigInt(rate)) / 1_000_000n;
      const charged = row.turnover > 0n ? part(periodRow.rate_branch) + part(periodRow.rate_funds) + part(periodRow.rate_initiator) : 0n;
      const returned = row.due - charged;
      const total = charged + row.retained;
      dues.splice(index, 1);
      const hash = chargeHashOf(COOP, data.username, data.braname, data.period);
      const at = '2026-12-01T00:30:00.000Z';
      if (total > 0n) chargeLog.push({ processHash: hash, operationCode: 'o.mkt.charge', quantity: toAsset(total) });
      if (returned > 0n) chargeLog.push({ processHash: hash, operationCode: 'o.mkt.retdue', quantity: toAsset(returned) });
      if (total > 0n) await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, toAsset(total).split(' ')[0], 1000 + chargeLog.length * 2, { process_hash: hash, username: data.username }, at));
      if (returned > 0n) await service.applyOperation(apply(MarketplaceSecureDueOperation.RETURN_DUE, toAsset(returned).split(' ')[0], 1001 + chargeLog.length * 2, { process_hash: hash, username: data.username }, at));
      return {};
    }),
  };
  const ledger2History = {
    getHistory: jest.fn(async (filter: { processHash?: string; operationCodes?: string[] }) => {
      const items = chargeLog.filter((op) => op.processHash === filter.processHash && (filter.operationCodes ?? []).includes(op.operationCode));
      return { items, totalCount: items.length, totalPages: 1, currentPage: 1 };
    }),
  };
  const accountPort = { getDisplayName: jest.fn(async (u: string) => `Имя ${u}`) };
  const notifications = { notifyUser: jest.fn(async () => undefined) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() };
  const service = new MarketplaceSecureDueService(
    store as never,
    orderRepo as never,
    claimRepo as never,
    chainPort as never,
    economy as never,
    accountPort as never,
    notifications as never,
    ledger2History as never,
    logger as never,
    periodService as never,
    { emit: jest.fn() } as never
  );

  /** Счётчики цепи после выдачи: строка пайщика и строка участка за период. */
  function onChain(row: Partial<ChainDue> & { period: number; turnover?: bigint; due?: bigint; retained?: bigint }) {
    const d: ChainDue = { username: USER, braname: BRANCH, orders: 1, turnover: 0n, due: 0n, retained: 0n, ...row };
    dues.push(d);
    const key = `${d.braname}/${d.period}`;
    const c = counters.get(key) ?? { braname: d.braname, period: d.period, turnover: 0n, secured: 0n, retained: 0n, orders: 0, members: 0 };
    c.turnover += d.turnover;
    c.secured += d.due;
    c.retained += d.retained;
    c.orders += d.orders;
    c.members += 1;
    counters.set(key, c);
  }

  return { service, store, chainPort, notifications, logger, claimRepo, periodService, onChain, dues, counters };
}

function apply(code: MarketplaceSecureDueOperation, amount: string, seq: number, extra: Record<string, unknown> = {}, blockTime = '2026-10-10T10:00:00.000Z') {
  return {
    transaction_id: 't',
    account: 'ledger2',
    block_num: seq,
    block_id: 'b',
    block_time: blockTime,
    chain_id: 'c',
    name: 'apply',
    receiver: 'ledger2',
    authorization: [],
    action_ordinal: 1,
    global_sequence: String(seq),
    account_ram_deltas: [],
    data: {
      coopname: COOP,
      initiator: 'marketplace',
      operation_code: code,
      process_type: 'p.mkt.supply',
      amount: `${amount} RUB`,
      username: USER,
      process_hash: ORDER.toUpperCase(),
      memo: '',
      ...extra,
    },
  } as never;
}

/** Хэш нитки списания строки пайщика теста за период конца гарантии (октябрь 2026). */
const DUE_HASH_OCTOBER = chargeHashOf(COOP, USER, BRANCH, OCTOBER);

describe('mkt.secure.due.side.1 — к списанию по выданному заказу: созревает к концу гарантийного срока', () => {
  it('строка заводится с остатком и датой конца гарантии', async () => {
    const warranty = new Date('2026-10-24T10:00:00.000Z');
    const { service, store } = build({ warrantyUntil: warranty });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    expect(store.rows.get(ORDER)).toMatchObject({ username: USER, braname: BRANCH, due_amount: '30.0000', due_from: warranty, charged_at: null });
  });

  it('заказ без гарантии созревает в момент выдачи', async () => {
    const { service, store } = build({ warrantyUntil: null });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    expect(store.rows.get(ORDER)?.due_from).toEqual(new Date('2026-10-10T10:00:00.000Z'));
  });
});

describe('mkt.secure.due.side.2 — удержание при отказе: тело и обеспечительная часть складываются в одну строку', () => {
  it('o.mkt.penal и o.mkt.todue по одному заказу — один остаток', async () => {
    const { service, store } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.PENALTY, '50.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '15.0000', 2));
    expect(store.rows.get(ORDER)?.due_amount).toBe('65.0000');
  });
});

describe('mkt.secure.due.side.3 — повтор события не учитывается дважды', () => {
  it('та же операция второй раз — остаток прежний', async () => {
    const { service, store } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 5));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '30.0000', 6, { process_hash: DUE_HASH_OCTOBER }));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '30.0000', 6, { process_hash: DUE_HASH_OCTOBER }));
    expect(store.rows.get(ORDER)).toMatchObject({ due_amount: '0.0000', charged_amount: '30.0000' });
  });
});

describe('mkt.secure.due.side.4 — гарантийный возврат уменьшает остаток; заказ ищется по заявлению', () => {
  it('o.mkt.undue по хэшу заявления — остаток заказа уменьшен, в списанное не идёт', async () => {
    const { service, store } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.UNDUE, '10.0000', 2, { process_hash: 'c'.repeat(64), process_type: 'p.mkt.return' }));
    expect(store.rows.get(ORDER)).toMatchObject({ due_amount: '20.0000', charged_amount: '0.0000', charged_at: null });
  });

  it('возврат всего — строка закрыта без списания', async () => {
    const { service, store } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.UNDUE, '30.0000', 2, { process_hash: 'c'.repeat(64) }));
    expect(store.rows.get(ORDER)).toMatchObject({ due_amount: '0.0000', charged_amount: '0.0000' });
    expect(store.rows.get(ORDER)?.charged_at).not.toBeNull();
  });
});

describe('mkt.secure.due.side.5 — выход пайщика: все его строки закрыты списанием', () => {
  it('o.mkt.exfee — остаток каждой строки переходит в списанное', async () => {
    const { service, store } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '20.0000', 2, { process_hash: ORDER_2 }));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.EXIT, '50.0000', 3, { process_hash: 'e'.repeat(64) }));
    expect(store.rows.get(ORDER)).toMatchObject({ due_amount: '0.0000', charged_amount: '30.0000' });
    expect(store.rows.get(ORDER_2)).toMatchObject({ due_amount: '0.0000', charged_amount: '20.0000' });
  });
});

describe('mkt.secure.due.side.6 — чужие операции учёт не трогают', () => {
  it('o.mkt.lock — строки нет', async () => {
    const { service, store } = build();
    await service.applyOperation(apply('o.mkt.lock' as MarketplaceSecureDueOperation, '100.0000', 1));
    expect(store.rows.size).toBe(0);
  });
});

describe('mkt.secure.due.side.7 — списание по окончании периода: только счётчики закончившихся периодов (UTC, как у контракта)', () => {
  it('гарантия кончилась в октябре — 1 ноября строка списывается: узел называет пайщика, участок и период, без сумм', async () => {
    const { service, chainPort, onChain } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    onChain({ period: OCTOBER, retained: toUnits('30.0000') });
    const res = await service.chargeDue(COOP, new Date('2026-11-01T00:30:00.000Z'));
    expect(res).toEqual({ charged: 1, failed: 0 });
    expect(chainPort.chargePeriod).toHaveBeenCalledWith({ coopname: COOP, username: USER, braname: BRANCH, period: OCTOBER });
  });

  it('31 октября 23:30 UTC — период ещё идёт, списания нет', async () => {
    const { service, chainPort, onChain } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    onChain({ period: OCTOBER, retained: toUnits('30.0000') });
    const res = await service.chargeDue(COOP, new Date('2026-10-31T23:30:00.000Z'));
    expect(res).toEqual({ charged: 0, failed: 0 });
    expect(chainPort.chargePeriod).not.toHaveBeenCalled();
  });

  it('гарантия идёт до 5 ноября — строка в счётчике ноября, 1 ноября не списывается', async () => {
    const { service, chainPort, onChain } = build({ warrantyUntil: new Date('2026-11-05T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    onChain({ period: NOVEMBER, retained: toUnits('30.0000') });
    await service.chargeDue(COOP, new Date('2026-11-01T10:00:00.000Z'));
    expect(chainPort.chargePeriod).not.toHaveBeenCalled();
  });
});

describe('mkt.secure.due.side.8 — пайщик с открытым гарантийным возвратом не списывается', () => {
  it('контракт отвечает MARKETPLACE_DUE_RETURN_PENDING — строка ждёт решения совета, это не сбой', async () => {
    const { service, chainPort, onChain, logger } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z'), openClaim: true });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    onChain({ period: OCTOBER, retained: toUnits('30.0000') });
    expect(await service.chargeDue(COOP, new Date('2026-12-01T10:00:00.000Z'))).toEqual({ charged: 0, failed: 1 });
    expect(chainPort.chargePeriod).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('открыт гарантийный возврат'));
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('mkt.secure.due.side.9 — письмо пайщику: одно за прогон и только если списано', () => {
  it('два заказа одного пайщика за период — одна строка счётчика, одно письмо с суммой и числом заказов', async () => {
    const { service, notifications, onChain } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '20.0000', 2, { process_hash: ORDER_2 }));
    onChain({ period: OCTOBER, retained: toUnits('50.0000'), orders: 2 });
    await service.chargeDue(COOP, new Date('2026-12-01T10:00:00.000Z'));
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      USER,
      'obespechitelnaya-chast-spisana',
      expect.objectContaining({ amount: '50,00 RUB', ordersCount: '2' })
    );
  });

  it('цепь отказала — письма нет', async () => {
    const { service, chainPort, notifications, onChain } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    chainPort.chargePeriod.mockRejectedValueOnce(new Error('MARKETPLACE_DUE_EXCEEDS: больше остатка'));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    onChain({ period: OCTOBER, retained: toUnits('30.0000') });
    const res = await service.chargeDue(COOP, new Date('2026-12-01T10:00:00.000Z'));
    expect(res).toEqual({ charged: 0, failed: 1 });
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });
});

describe('monthKey — месяц в часовом поясе кооператива', () => {
  it('полночь по Москве уже следующий месяц, по UTC ещё прошлый', () => {
    const instant = new Date('2026-10-31T21:30:00.000Z');
    expect(monthKey(instant, 'Europe/Moscow')).toBe(2026 * 12 + 11);
    expect(monthKey(instant, 'UTC')).toBe(2026 * 12 + 10);
  });
});

describe('mkt.secure.due.side.11 — обеспечительная часть в карточке заказа', () => {
  // Заказ из ответа карточки; статус строкой, как его отдаёт база.
  const order = (over: Record<string, unknown> = {}): any => ({
    id: 'order-1',
    coopname: COOP,
    order_hash: ORDER.toUpperCase(),
    membership_fee: '30.0000',
    status: 'ACCEPTED',
    ...over,
  });

  function withClaims(open: boolean) {
    const built = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    (built.claimRepo as any).findActiveByOrderId = jest.fn(async () => (open ? { id: 'claim-1' } : null));
    return built;
  }

  it('до получения — в резерве на сумму обеспечительной части заказа', async () => {
    const { service } = withClaims(false);
    expect(await service.securePartOf(order())).toMatchObject({ state: 'RESERVED', amount: '30.0000', charge_at: null });
  });

  it('отменённый заказ — возвращена; заказ прежней модели без строки учёта — блока нет', async () => {
    const { service } = withClaims(false);
    expect(await service.securePartOf(order({ status: 'CANCELLED_BY_SUPPLIER' }))).toMatchObject({ state: 'RETURNED' });
    expect(await service.securePartOf(order({ status: 'RECEIVED' }))).toBeNull();
    expect(await service.securePartOf(order({ membership_fee: '0.0000' }))).toBeNull();
  });

  it('после выдачи — ждёт списания с датой: начало следующего месяца после гарантии по часовому поясу кооператива', async () => {
    const { service } = withClaims(false);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    const part = await service.securePartOf(order({ status: 'RECEIVED' }), new Date('2026-10-25T10:00:00.000Z'));
    expect(part).toMatchObject({ state: 'DUE', amount: '30.0000', due_amount: '30.0000', charged_amount: '0.0000' });
    expect(part?.charge_at).toEqual(new Date('2026-10-31T21:00:00.000Z'));
  });

  it('срок прошёл, а строка ещё не списана — дата списания: ближайшее начало месяца', async () => {
    const { service } = withClaims(false);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    const tenthOfNovember = new Date('2026-11-10T10:00:00.000Z');
    expect((await service.securePartOf(order({ status: 'RECEIVED' }), tenthOfNovember))?.charge_at).toEqual(new Date('2026-11-30T21:00:00.000Z'));
  });

  it('открытый гарантийный возврат приостанавливает списание, даты нет', async () => {
    const { service } = withClaims(true);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    expect(await service.securePartOf(order({ status: 'RECEIVED' }))).toMatchObject({ state: 'SUSPENDED', charge_at: null });
  });

  it('после списания — списана с моментом списания; после гарантийного возврата — возвращена', async () => {
    const charged = withClaims(false);
    await charged.service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await charged.service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '30.0000', 2, { process_hash: DUE_HASH_OCTOBER }, '2026-11-01T00:05:00.000Z'));
    expect(await charged.service.securePartOf(order({ status: 'RECEIVED' }))).toMatchObject({
      state: 'CHARGED',
      charged_amount: '30.0000',
      settled_at: new Date('2026-11-01T00:05:00.000Z'),
    });

    const returned = withClaims(false);
    await returned.service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await returned.service.applyOperation(apply(MarketplaceSecureDueOperation.UNDUE, '30.0000', 2, { process_hash: 'C'.repeat(64) }));
    expect(await returned.service.securePartOf(order({ status: 'RECEIVED' }))).toMatchObject({ state: 'RETURNED', charged_amount: '0.0000' });
  });
});

// ── Коэффициент экономического участия (задачи 99D-22, 99D-33; случаи mkt.order.keu.12–15) ──

describe('mkt.order.keu.12 — стоимость заказа в строке зеркала и закрытие заказов ниткой списания', () => {
  it('o.mkt.consum пишет стоимость заказа; порядок с o.mkt.todue в одной транзакции не важен', async () => {
    const first = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await first.service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, '10000.0000', 1));
    await first.service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 2));
    expect(first.store.rows.get(ORDER)).toMatchObject({ base_amount: '10000.0000', due_amount: '3800.0000', charged_at: null });

    const second = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await second.service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 1));
    await second.service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, '10000.0000', 2));
    expect(second.store.rows.get(ORDER)).toMatchObject({ base_amount: '10000.0000', due_amount: '3800.0000' });
  });

  it('повтор o.mkt.consum стоимость не удваивает; у удержания при отказе стоимость ноль', async () => {
    const { service, store } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, '10000.0000', 3));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, '10000.0000', 3));
    expect(store.rows.get(ORDER)?.base_amount).toBe('10000.0000');
    await service.applyOperation(apply(MarketplaceSecureDueOperation.PENALTY, '50.0000', 4, { process_hash: ORDER_2 }));
    expect(store.rows.get(ORDER_2)?.base_amount).toBe('0.0000');
  });

  it('списание и возврат по хэшу строки счётчика закрывают заказ: остаток ноль, списанное и возвращённое учтены', async () => {
    const { service, store } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '3234.8900', 2, { process_hash: DUE_HASH_OCTOBER }));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.RETURN_DUE, '565.1100', 3, { process_hash: DUE_HASH_OCTOBER }));
    expect(store.rows.get(ORDER)).toMatchObject({ due_amount: '0.0000', charged_amount: '3234.8900', returned_amount: '565.1100' });
    expect(store.rows.get(ORDER)?.charged_at).not.toBeNull();
  });

  it('два заказа пайщика за период: сумма операции раскладывается по заказам пропорционально обеспечительной части, остаток — последнему', async () => {
    const { service, store } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '7600.0000', 2, { process_hash: ORDER_2 }));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '9462.8700', 3, { process_hash: DUE_HASH_OCTOBER }));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.RETURN_DUE, '1937.1300', 4, { process_hash: DUE_HASH_OCTOBER }));
    const first = store.rows.get(ORDER)!;
    const second = store.rows.get(ORDER_2)!;
    expect(toUnits(first.charged_amount) + toUnits(second.charged_amount)).toBe(toUnits('9462.8700'));
    expect(toUnits(first.returned_amount) + toUnits(second.returned_amount)).toBe(toUnits('1937.1300'));
    expect(toUnits(first.charged_amount) + toUnits(first.returned_amount)).toBe(toUnits('3800.0000'));
    expect([first.due_amount, second.due_amount]).toEqual(['0.0000', '0.0000']);
  });

  it('операция нитки списания без заказов в зеркале — тревога в журнал, учёт не падает', async () => {
    const { service, logger } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '10.0000', 2, { process_hash: DUE_HASH_OCTOBER }));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('не нашло заказов в зеркале'));
  });
});

describe('mkt.order.keu.13 — прогон по счётчикам цепи по ставкам итога периода', () => {
  const warranty = new Date('2026-10-24T10:00:00.000Z');
  const firstOfNovember = new Date('2026-11-01T00:30:00.000Z');

  async function issued(service: MarketplaceSecureDueService, hash: string, base: string, due: string, seq: number) {
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, base, seq, { process_hash: hash }));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, due, seq + 1, { process_hash: hash }));
  }

  it('счётчик участка со стоимостью: стирание старых итогов, итог с числом строк пайщиков, списание строки без сумм, ставки участка Б в зеркале', async () => {
    const { service, store, chainPort, periodService, onChain } = build({ warrantyUntil: warranty });
    await issued(service, ORDER, '10000.0000', '3800.0000', 1);
    await issued(service, ORDER_2, '20000.0000', '7600.0000', 3);
    onChain({ period: OCTOBER, turnover: toUnits('30000.0000'), due: toUnits('11400.0000'), orders: 2 });

    const res = await service.chargeDue(COOP, firstOfNovember);
    expect(res).toEqual({ charged: 1, failed: 0 });
    expect(periodService.pruneOld).toHaveBeenCalledWith(COOP, BRANCH, NOVEMBER, new Set([OCTOBER]));
    expect(periodService.ensureClosed).toHaveBeenCalledWith(COOP, BRANCH, OCTOBER, 1);
    expect(chainPort.chargePeriod).toHaveBeenCalledWith({ coopname: COOP, username: USER, braname: BRANCH, period: OCTOBER });
    expect(periodService.noteCharged).toHaveBeenCalledWith(COOP, BRANCH, OCTOBER, 1, 0n);
    // Заглушка цепи делит строку по ставкам участка Б: 4 999,98 + 1 329,09 + 3 133,80 списано, 1 937,13 обратно — на оба заказа.
    const first = store.rows.get(ORDER)!;
    const second = store.rows.get(ORDER_2)!;
    expect(toUnits(first.charged_amount) + toUnits(second.charged_amount)).toBe(toUnits('9462.8700'));
    expect(toUnits(first.returned_amount) + toUnits(second.returned_amount)).toBe(toUnits('1937.1300'));
    expect([first.due_amount, second.due_amount]).toEqual(['0.0000', '0.0000']);
  });

  it('mkt.order.keu.19 — участок без выданных заказов за прошлый месяц получает итог без заказов; участок со счётчиком — обычный итог', async () => {
    const { service, periodService, onChain } = build({ warrantyUntil: warranty });
    onChain({ period: OCTOBER, turnover: toUnits('1000.0000'), due: toUnits('380.0000') });
    periodService.quietCandidates.mockResolvedValue([BRANCH, 'odn']);
    await service.chargeDue(COOP, firstOfNovember);
    expect(periodService.ensureQuietClosed).toHaveBeenCalledWith(COOP, 'odn', OCTOBER);
    expect(periodService.ensureQuietClosed).not.toHaveBeenCalledWith(COOP, BRANCH, OCTOBER);
    expect(periodService.ensureClosed).toHaveBeenCalledWith(COOP, BRANCH, OCTOBER, 1);
  });

  it('удержание при отказе без стоимости списывается целиком участку; счётчик без стоимости — как месяц без заказов: итог, если месяцу есть что нести (99D-34)', async () => {
    const { service, chainPort, periodService, store, onChain } = build({ warrantyUntil: warranty });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.PENALTY, '50.0000', 1));
    onChain({ period: OCTOBER, retained: toUnits('50.0000') });
    expect(await service.chargeDue(COOP, firstOfNovember)).toEqual({ charged: 1, failed: 0 });
    expect(chainPort.chargePeriod).toHaveBeenCalledWith({ coopname: COOP, username: USER, braname: BRANCH, period: OCTOBER });
    expect(periodService.ensureClosed).not.toHaveBeenCalled();
    expect(periodService.ensureQuietClosed).toHaveBeenCalledWith(COOP, BRANCH, OCTOBER);
    expect(store.rows.get(ORDER)).toMatchObject({ due_amount: '0.0000', charged_amount: '50.0000' });
  });

  it('итог участка не рассчитан — строка со стоимостью ждёт следующего прохода, удержание другого пайщика списывается', async () => {
    const { service, chainPort, periodService, onChain } = build({ warrantyUntil: warranty });
    periodService.ensureClosed.mockRejectedValueOnce(new Error('MARKETPLACE_PERIOD_AMOUNT_INVALID: ноль'));
    await issued(service, ORDER, '10000.0000', '3800.0000', 1);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.PENALTY, '50.0000', 5, { process_hash: ORDER_2, username: 'orderer2' }));
    onChain({ period: OCTOBER, turnover: toUnits('10000.0000'), due: toUnits('3800.0000') });
    onChain({ period: OCTOBER, username: 'orderer2', retained: toUnits('50.0000') });
    const res = await service.chargeDue(COOP, firstOfNovember);
    expect(res).toEqual({ charged: 1, failed: 1 });
    expect(chainPort.chargePeriod).toHaveBeenCalledTimes(1);
    expect(chainPort.chargePeriod).toHaveBeenCalledWith(expect.objectContaining({ username: 'orderer2' }));
  });

  it('отказ контракта по строке — строка остаётся, остальные идут; MARKETPLACE_DUE_EXCEEDS — тревога в журнал', async () => {
    const { service, chainPort, logger, onChain } = build({ warrantyUntil: warranty });
    chainPort.chargePeriod.mockRejectedValueOnce(new Error('MARKETPLACE_DUE_EXCEEDS: больше остатка'));
    await issued(service, ORDER, '10000.0000', '3800.0000', 1);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.PENALTY, '50.0000', 5, { process_hash: ORDER_2, username: 'orderer2' }));
    onChain({ period: OCTOBER, turnover: toUnits('10000.0000'), due: toUnits('3800.0000') });
    onChain({ period: OCTOBER, username: 'orderer2', retained: toUnits('50.0000') });
    const res = await service.chargeDue(COOP, firstOfNovember);
    expect(res).toEqual({ charged: 1, failed: 1 });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('разошёлся с кошельком'));
  });

  it('два участка — два итога периода, каждый по своему счётчику', async () => {
    const { service, periodService, onChain } = build({ warrantyUntil: warranty });
    onChain({ period: OCTOBER, turnover: toUnits('10000.0000'), due: toUnits('3800.0000') });
    onChain({ period: OCTOBER, braname: 'branch2', turnover: toUnits('5000.0000'), due: toUnits('1900.0000') });
    await service.chargeDue(COOP, firstOfNovember);
    const branches = periodService.ensureClosed.mock.calls.map((c: any[]) => c[1]).sort();
    expect(branches).toEqual([BRANCH, 'branch2']);
  });

  it('не больше двухсот списаний за проход: остальные строки берёт следующий', async () => {
    const { service, chainPort, onChain } = build({ warrantyUntil: warranty });
    for (let i = 0; i < 230; i++) onChain({ period: OCTOBER, username: `m${i}`, retained: toUnits('1.0000') });
    expect(await service.chargeDue(COOP, firstOfNovember)).toEqual({ charged: 200, failed: 0 });
    expect(chainPort.chargePeriod).toHaveBeenCalledTimes(200);
    expect(await service.chargeDue(COOP, firstOfNovember)).toEqual({ charged: 30, failed: 0 });
  });
});

describe('mkt.order.keu.14 — письмо после прогона по ставкам: списано, возвращено, ставка', () => {
  it('одно письмо на пайщика с суммами по операциям нитки списания', async () => {
    const { service, notifications, onChain } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, '10000.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 2));
    onChain({ period: OCTOBER, turnover: toUnits('10000.0000'), due: toUnits('3800.0000') });
    await service.chargeDue(COOP, new Date('2026-11-01T00:30:00.000Z'));
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      USER,
      'obespechitelnaya-chast-spisana',
      expect.objectContaining({ amount: AmountFormatterUtils.formatAmountSafe('3154.2900 RUB'), returnedAmount: '645,71 RUB', ratePercent: '31.54', ordersCount: '1' })
    );
  });

  it('карточка заказа после списания по ставкам: списано и возвращено, сумма — вся обеспечительная часть', async () => {
    const { service } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    (service as any).claimRepo.findActiveByOrderId = jest.fn(async () => null);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '3234.8900', 2, { process_hash: DUE_HASH_OCTOBER }, '2026-11-01T00:05:00.000Z'));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.RETURN_DUE, '565.1100', 3, { process_hash: DUE_HASH_OCTOBER }, '2026-11-01T00:05:00.000Z'));
    const part = await service.securePartOf({ id: 'o', coopname: COOP, order_hash: ORDER.toUpperCase(), membership_fee: '3800.0000', status: 'RECEIVED' as never });
    expect(part).toMatchObject({ state: 'CHARGED', amount: '3800.0000', charged_amount: '3234.8900', returned_amount: '565.1100' });
  });
});

describe('mkt.order.keu.15 — коэффициент экономического участия в карточке заказа и заказы, которые созреют к концу периода', () => {
  const chargedAt = new Date('2026-12-01T00:30:00.000Z');

  it('списанный заказ со стоимостью — ставка итога периода конца гарантии; удержание без стоимости — 100 %', async () => {
    const { service, store } = build({ mirroredPeriod: NOVEMBER });
    store.rows.set(ORDER, {
      order_hash: ORDER, coopname: COOP, username: USER, braname: BRANCH,
      due_amount: '0.0000', charged_amount: '3154.2900', base_amount: '10000.0000', returned_amount: '645.7100',
      due_from: new Date('2026-11-10T00:00:00.000Z'), charged_at: chargedAt, last_sequence: '1',
    } as never);
    const part = await service.securePartOf({ id: 'o1', coopname: COOP, order_hash: ORDER, membership_fee: '3800.0000', status: 'RECEIVED' as never });
    expect(part).toMatchObject({ state: 'CHARGED', charged_amount: '3154.2900', returned_amount: '645.7100', rate_percent: '31.54' });

    const penalty = 'b'.repeat(64);
    store.rows.set(penalty, {
      order_hash: penalty, coopname: COOP, username: USER, braname: BRANCH,
      due_amount: '0.0000', charged_amount: '50.0000', base_amount: '0.0000', returned_amount: '0.0000',
      due_from: new Date('2026-11-10T00:00:00.000Z'), charged_at: chargedAt, last_sequence: '2',
    } as never);
    const penaltyPart = await service.securePartOf({ id: 'o2', coopname: COOP, order_hash: penalty, membership_fee: '50.0000', status: 'CANCELLED_BY_ORDERER' as never });
    expect(penaltyPart).toMatchObject({ state: 'CHARGED', rate_percent: '100.00' });
  });

  it('зеркала итога нет (списано до модели) — ставки нет; до списания ставки нет', async () => {
    const { service, store } = build();
    store.rows.set(ORDER, {
      order_hash: ORDER, coopname: COOP, username: USER, braname: BRANCH,
      due_amount: '0.0000', charged_amount: '3800.0000', base_amount: '10000.0000', returned_amount: '0.0000',
      due_from: new Date('2026-11-10T00:00:00.000Z'), charged_at: chargedAt, last_sequence: '1',
    } as never);
    expect(await service.securePartOf({ id: 'o1', coopname: COOP, order_hash: ORDER, membership_fee: '3800.0000', status: 'RECEIVED' as never }))
      .toMatchObject({ state: 'CHARGED', rate_percent: null });
    store.rows.set(ORDER, { ...store.rows.get(ORDER)!, due_amount: '3800.0000', charged_amount: '0.0000', charged_at: null } as never);
    expect(await service.securePartOf({ id: 'o1', coopname: COOP, order_hash: ORDER, membership_fee: '3800.0000', status: 'RECEIVED' as never }))
      .toMatchObject({ state: 'DUE', rate_percent: null });
  });

  it('созреют к концу периода — из счётчиков участка в цепи: текущий и более ранние открытые периоды; чужой участок и будущий период не входят', async () => {
    const { service, onChain } = build();
    onChain({ period: NOVEMBER, turnover: toUnits('10000.0000'), due: toUnits('3800.0000') });
    onChain({ period: NOVEMBER, username: 'orderer2', turnover: toUnits('20000.0000'), due: toUnits('7600.0000') });
    onChain({ period: NOVEMBER + 1, username: 'orderer3', turnover: toUnits('5000.0000'), due: toUnits('1000.0000') }); // гарантия кончится в декабре
    onChain({ period: NOVEMBER, braname: 'branch2', username: 'orderer4', turnover: toUnits('1000.0000'), due: toUnits('500.0000') }); // чужой участок
    const now = new Date('2026-11-15T12:00:00.000Z');
    expect(await service.ripeningForBranch(COOP, BRANCH, now)).toEqual({ count: 2, turnover: toUnits('30000.0000'), secured: toUnits('11400.0000') });
    expect(await service.ripeningForBranch(COOP, 'branch2', now)).toEqual({ count: 1, turnover: toUnits('1000.0000'), secured: toUnits('500.0000') });
  });
});

describe('mkt.secure.due.side.13 — переходный перенос зеркала в счётчики при первом старте (задача 99D-33)', () => {
  it('счётчиков в цепи нет — незакрытые строки зеркала переносятся: период по концу гарантии, удержание — целиком участку', async () => {
    const { service, chainPort } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, '10000.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 2));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.PENALTY, '50.0000', 3, { process_hash: ORDER_2 }));
    expect(await service.migrateMirror()).toEqual({ moved: 2, failed: 0 });
    expect(chainPort.migrateDue).toHaveBeenCalledWith({
      coopname: COOP, username: USER, braname: BRANCH, period: OCTOBER,
      turnover: '10000.0000 RUB', due: '3800.0000 RUB', retained: '0.0000 RUB',
    });
    expect(chainPort.migrateDue).toHaveBeenCalledWith({
      coopname: COOP, username: USER, braname: BRANCH, period: OCTOBER,
      turnover: '0.0000 RUB', due: '0.0000 RUB', retained: '50.0000 RUB',
    });
  });

  it('счётчики уже ведутся — переноса нет; отказ контракта по строке не роняет остальные', async () => {
    const kept = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await kept.service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 1));
    kept.onChain({ period: OCTOBER, due: toUnits('3800.0000'), turnover: toUnits('10000.0000') });
    expect(await kept.service.migrateMirror()).toEqual({ moved: 0, failed: 0 });
    expect(kept.chainPort.migrateDue).not.toHaveBeenCalled();

    const partial = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    partial.chainPort.migrateDue.mockRejectedValueOnce(new Error('MARKETPLACE_DUE_EXCEEDS: перенос превышает остаток'));
    await partial.service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 1));
    await partial.service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '1000.0000', 2, { process_hash: ORDER_2 }));
    expect(await partial.service.migrateMirror()).toEqual({ moved: 1, failed: 1 });
    expect(partial.logger.error).toHaveBeenCalledWith(expect.stringContaining('не перенесён'));
  });
});
