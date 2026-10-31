/**
 * Обеспечительная часть паевого взноса к списанию (задача 99D-18, решение
 * владельца 31.10.2026).
 *
 * Узел ведёт учёт по операциям ledger2, которые провёл контракт: к списанию
 * (o.mkt.todue, o.mkt.penal), гарантийный возврат (o.mkt.undue), списание
 * (o.mkt.charge) и выход пайщика (o.mkt.exfee). Крон первого числа списывает
 * строки, созревшие до начала месяца, — по одной транзакции chargedue на
 * заказ; письмо пайщику — одно за прогон и только если что-то списано.
 *
 * Реестр: mkt.secure.due.side.1–9.
 */
jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return {
    ...actual,
    platformSettings: () => ({ coopname: 'voskhod', timezone: 'Europe/Moscow', frontendUrl: 'https://coop.test' }),
  };
});

import {
  MarketplaceSecureDueOperation,
  MarketplaceSecureDueService,
  monthKey,
} from '~/extensions/marketplace/application/services/marketplace-secure-due.service';
import type { MarketplaceSecureDueEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-secure-due.entity';

const COOP = 'voskhod';
const ORDER = 'a'.repeat(64);
const ORDER_2 = 'b'.repeat(64);

function toUnits(value: string): bigint {
  const [int = '0', frac = ''] = (String(value).trim().split(/\s+/)[0] ?? '0').split('.');
  return BigInt(int) * 10_000n + BigInt((frac + '0000').slice(0, 4));
}
function toAsset(units: bigint): string {
  const padded = units.toString().padStart(5, '0');
  return `${padded.slice(0, -4)}.${padded.slice(-4)} RUB`;
}

/** Шлюз таблицы в памяти: поддерживает равенство полей и условия, которыми пользуется сервис. */
function memoryStore() {
  const rows = new Map<string, MarketplaceSecureDueEntity>();
  const matches = (row: any, where: Record<string, any>) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'operator' in v) {
        if (v.operator === 'is null') return row[k] == null;
        if (v.operator === '<=') return row[k] != null && row[k] <= v.value;
        return true;
      }
      return row[k] === v;
    });
  return {
    rows,
    findOne: jest.fn(async (where: any) => [...rows.values()].find((r) => matches(r, where)) ?? null),
    find: jest.fn(async (where: any) => [...rows.values()].filter((r) => matches(r, where))),
    insert: jest.fn(async (fields: any) => {
      rows.set(fields.order_hash, { created_at: new Date(), updated_at: new Date(), ...fields });
      return rows.get(fields.order_hash);
    }),
    update: jest.fn(async (where: any, patch: any) => {
      const row = rows.get(where.order_hash);
      if (!row) return 0;
      rows.set(where.order_hash, { ...row, ...patch });
      return 1;
    }),
  };
}

function build(opts: { warrantyUntil?: Date | null; openClaimOrders?: string[] } = {}) {
  const store = memoryStore();
  const orderRepo = {
    findByOrderHash: jest.fn(async (_c: string, hash: string) => ({
      order_hash: hash,
      delivery_braname: 'branch1',
      warranty_until: opts.warrantyUntil ?? null,
    })),
  };
  const claimRepo = {
    findByRequestHash: jest.fn(async (_c: string, hash: string) => (hash === 'c'.repeat(64) ? { order_hash: ORDER.toUpperCase() } : null)),
    listByStatus: jest.fn(async () => (opts.openClaimOrders ?? []).map((order_hash) => ({ order_hash }))),
  };
  const chainPort = { chargeDue: jest.fn(async () => ({})) };
  const economy = { assetToUnits: (v: string) => toUnits(v), unitsToAsset: (u: bigint) => toAsset(u) };
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
    logger as never
  );
  return { service, store, chainPort, notifications, logger, claimRepo };
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
      username: 'orderer1',
      process_hash: ORDER.toUpperCase(),
      memo: '',
      ...extra,
    },
  } as never;
}

describe('mkt.secure.due.side.1 — к списанию по выданному заказу: созревает к концу гарантийного срока', () => {
  it('строка заводится с остатком и датой конца гарантии', async () => {
    const warranty = new Date('2026-10-24T10:00:00.000Z');
    const { service, store } = build({ warrantyUntil: warranty });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    expect(store.rows.get(ORDER)).toMatchObject({ username: 'orderer1', braname: 'branch1', due_amount: '30.0000', due_from: warranty, charged_at: null });
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
    const { service, store } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 5));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '30.0000', 6));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '30.0000', 6));
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

describe('mkt.secure.due.side.7 — списание первого числа: только созревшее до начала месяца по часовому поясу кооператива', () => {
  it('гарантия кончилась в октябре — 1 ноября списывается, сумма и участок из строки', async () => {
    const { service, chainPort } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    const res = await service.chargeDue(COOP, new Date('2026-10-31T21:30:00.000Z')); // 1 ноября 00:30 по Москве
    expect(res).toEqual({ charged: 1, failed: 0 });
    expect(chainPort.chargeDue).toHaveBeenCalledWith({ coopname: COOP, username: 'orderer1', braname: 'branch1', order_hash: ORDER, amount: '30.0000 RUB' });
  });

  it('31 октября по Москве — месяц ещё не сменился, списания нет', async () => {
    const { service, chainPort } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    const res = await service.chargeDue(COOP, new Date('2026-10-31T20:30:00.000Z')); // 31 октября 23:30 по Москве
    expect(res).toEqual({ charged: 0, failed: 0 });
    expect(chainPort.chargeDue).not.toHaveBeenCalled();
  });

  it('гарантия идёт до 5 ноября — 1 ноября не списывается', async () => {
    const { service, chainPort } = build({ warrantyUntil: new Date('2026-11-05T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await service.chargeDue(COOP, new Date('2026-11-01T10:00:00.000Z'));
    expect(chainPort.chargeDue).not.toHaveBeenCalled();
  });
});

describe('mkt.secure.due.side.8 — заказ с открытым гарантийным возвратом не списывается', () => {
  it('заявление в работе — строка ждёт решения совета', async () => {
    const { service, chainPort } = build({ openClaimOrders: [ORDER] });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await service.chargeDue(COOP, new Date('2026-12-01T10:00:00.000Z'));
    expect(chainPort.chargeDue).not.toHaveBeenCalled();
  });
});

describe('mkt.secure.due.side.9 — письмо пайщику: одно за прогон и только если списано', () => {
  it('два заказа одного пайщика — одно письмо с суммой и числом заказов', async () => {
    const { service, notifications } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '20.0000', 2, { process_hash: ORDER_2 }));
    await service.chargeDue(COOP, new Date('2026-12-01T10:00:00.000Z'));
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'orderer1',
      'obespechitelnaya-chast-spisana',
      expect.objectContaining({ amount: '50.0000 RUB', ordersCount: '2' })
    );
  });

  it('цепь отказала — письма нет', async () => {
    const { service, chainPort, notifications } = build();
    chainPort.chargeDue.mockRejectedValueOnce(new Error('MARKETPLACE_DUE_EXCEEDS: больше остатка'));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
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
