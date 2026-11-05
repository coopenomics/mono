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

import { AmountFormatterUtils } from '@coopenomics/extension-kit';
import {
  MarketplaceSecureDueOperation,
  MarketplaceSecureDueService,
  monthKey,
} from '~/extensions/marketplace/application/services/marketplace-secure-due.service';
import type { MarketplaceSecureDueEntity } from '~/extensions/marketplace/infrastructure/entities/marketplace-secure-due.entity';
import { memoryTable, toAsset, toUnits } from './helpers/memory-table';
import { runQueriesOver } from './helpers/keu-world';
import { useRealCalendar } from './helpers/real-calendar';

const COOP = 'voskhod';

useRealCalendar();
const ORDER = 'a'.repeat(64);
const ORDER_2 = 'b'.repeat(64);

function build(opts: { warrantyUntil?: Date | null; openClaimOrders?: string[]; mirroredPeriod?: number } = {}) {
  const store = memoryTable<MarketplaceSecureDueEntity>((row) => row.order_hash);
  const orderRepo = {
    findByOrderHash: jest.fn(async (_c: string, hash: string) => ({
      order_hash: hash,
      delivery_braname: 'branch1',
      warranty_until: opts.warrantyUntil ?? null,
    })),
  };
  const claimRepo = {
    findByRequestHash: jest.fn(async (_c: string, hash: string) => (hash === 'c'.repeat(64) ? { order_hash: ORDER.toUpperCase() } : null)),
    listActiveOrderHashes: jest.fn(async () => opts.openClaimOrders ?? []),
    // Открытой претензии по заказу нет: карточка заказа читает ставку списания без гарантийного спора.
    findActiveByOrderId: jest.fn(async () => null),
  };
  const economy = { assetToUnits: (v: string) => toUnits(v), unitsToAsset: (u: bigint) => toAsset(u) };
  // Итог месяца и ставки (задача 99D-22): ставки участка Б из документа модели.
  const periodRow = {
    coopname: COOP, braname: 'branch1', period: 0,
    rate_branch: '166666', rate_funds: '44303', rate_initiator: '104460',
    rows_total: 0, rows_charged: 0, deleted_at: null,
  };
  const periodService = {
    // Итог месяца прежним проходом не рассчитан: ни в зеркале, ни в цепи его нет.
    adoptClosed: jest.fn(async () => null),
    pruneOld: jest.fn(async () => undefined),
    ensureClosed: jest.fn(async (_c: string, _b: string, period: number, _t: bigint, _s: bigint, rows: number) => ({ ...periodRow, period, rows_total: rows })),
    noteCharged: jest.fn(async () => undefined),
    ratePercentOf: jest.fn(() => '31.54'),
    // Зеркало итога месяца для ставки в карточке заказа: есть только у периода из build().
    findOne: jest.fn(async (_c: string, _b: string, period: number) => (opts.mirroredPeriod === period ? { ...periodRow, period } : null)),
  };
  const chainPort = {
    chargeDue: jest.fn(async () => ({})),
    // Списание по ставкам: как на стенде, строка учёта обновляется слушателем
    // до возврата транзакции — здесь это делает заглушка цепи по тем же ставкам.
    chargePeriod: jest.fn(async (data: { order_hash: string; amount: string; base: string }) => {
      const row = store.rows.get(data.order_hash);
      if (!row) return {};
      const base = toUnits(data.base);
      const amount = toUnits(data.amount);
      const part = (rate: string) => (base * BigInt(rate)) / 1_000_000n;
      const charged = part(periodRow.rate_branch) + part(periodRow.rate_funds) + part(periodRow.rate_initiator);
      const returned = amount - charged;
      store.rows.set(data.order_hash, {
        ...row,
        due_amount: '0.0000',
        charged_amount: toAsset(toUnits(row.charged_amount) + charged).split(' ')[0],
        returned_amount: toAsset(toUnits(row.returned_amount ?? '0') + returned).split(' ')[0],
        charged_at: new Date(),
      });
      return {};
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
    logger as never,
    periodService as never,
    runQueriesOver(store) as never
  );
  return { service, store, chainPort, notifications, logger, claimRepo, periodService };
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
      expect.objectContaining({ amount: '50,00 RUB', ordersCount: '2' })
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

  it('после выдачи — ждёт списания с датой: полночь первого числа месяца после гарантии по часовому поясу кооператива', async () => {
    const { service } = withClaims(false);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    const part = await service.securePartOf(order({ status: 'RECEIVED' }), new Date('2026-10-25T10:00:00.000Z'));
    expect(part).toMatchObject({ state: 'DUE', amount: '30.0000', due_amount: '30.0000', charged_amount: '0.0000' });
    expect(part?.charge_at).toEqual(new Date('2026-10-31T21:00:00.000Z'));
  });

  it('срок прошёл, а в список идущего прогона строка не вошла — дата списания: ближайшее первое число', async () => {
    const { service, store } = withClaims(false);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    // 10 ноября: итог октября рассчитан без этой строки (гарантийный возврат закрыт позже).
    const tenthOfNovember = new Date('2026-11-10T10:00:00.000Z');
    expect((await service.securePartOf(order({ status: 'RECEIVED' }), tenthOfNovember))?.charge_at).toEqual(new Date('2026-11-30T21:00:00.000Z'));
    // Строка в списке прогона октября: списание идёт этим прогоном, дата прежняя.
    const row = store.rows.get(ORDER)!;
    store.rows.set(ORDER, { ...row, run_period: 2026 * 12 + 10 });
    expect((await service.securePartOf(order({ status: 'RECEIVED' }), tenthOfNovember))?.charge_at).toEqual(new Date('2026-10-31T21:00:00.000Z'));
  });

  it('открытый гарантийный возврат приостанавливает списание, даты нет', async () => {
    const { service } = withClaims(true);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    expect(await service.securePartOf(order({ status: 'RECEIVED' }))).toMatchObject({ state: 'SUSPENDED', charge_at: null });
  });

  it('после списания — списана с моментом списания; после гарантийного возврата — возвращена', async () => {
    const charged = withClaims(false);
    await charged.service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '30.0000', 1));
    await charged.service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '30.0000', 2, {}, '2026-11-01T00:05:00.000Z'));
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

// ── Коэффициент экономического участия (задача 99D-22, случаи mkt.order.keu.12–14) ──

describe('mkt.order.keu.12 — стоимость заказа в строке учёта', () => {
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

  it('o.mkt.retdue уменьшает остаток и копит возвращённое, в списанное не идёт', async () => {
    const { service, store } = build();
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '3234.8900', 2));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.RETURN_DUE, '565.1100', 3));
    expect(store.rows.get(ORDER)).toMatchObject({ due_amount: '0.0000', charged_amount: '3234.8900', returned_amount: '565.1100' });
    expect(store.rows.get(ORDER)?.charged_at).not.toBeNull();
  });
});

describe('mkt.order.keu.13 — прогон первого числа по ставкам итога месяца', () => {
  const warranty = new Date('2026-10-24T10:00:00.000Z');
  const firstOfDecember = new Date('2026-11-30T21:30:00.000Z'); // 1 декабря 00:30 по Москве

  async function issued(service: MarketplaceSecureDueService, hash: string, base: string, due: string, seq: number) {
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, base, seq, { process_hash: hash }));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, due, seq + 1, { process_hash: hash }));
  }

  it('строки со стоимостью: стирание старого итога, расчёт по сумме стоимостей и собранного, списание по ставкам, число строк', async () => {
    const { service, store, chainPort, periodService } = build({ warrantyUntil: warranty });
    await issued(service, ORDER, '10000.0000', '3800.0000', 1);
    await issued(service, ORDER_2, '20000.0000', '7600.0000', 3);

    const res = await service.chargeDue(COOP, firstOfDecember);
    expect(res).toEqual({ charged: 2, failed: 0 });
    const november = 2026 * 12 + 11;
    expect(periodService.pruneOld).toHaveBeenCalledWith(COOP, 'branch1', november);
    expect(periodService.ensureClosed).toHaveBeenCalledWith(COOP, 'branch1', november, toUnits('30000.0000'), toUnits('11400.0000'), 2);
    expect(chainPort.chargePeriod).toHaveBeenCalledWith({ coopname: COOP, username: 'orderer1', braname: 'branch1', order_hash: ORDER, amount: '3800.0000 RUB', base: '10000.0000 RUB', period: november });
    expect(chainPort.chargeDue).not.toHaveBeenCalled();
    expect(periodService.noteCharged).toHaveBeenCalledTimes(2);
    // Заглушка цепи обновила строки по ставкам участка Б: 1 666,66 + 443,03 + 1 044,60 списано, 645,71 обратно.
    expect(store.rows.get(ORDER)).toMatchObject({ due_amount: '0.0000', charged_amount: '3154.2900', returned_amount: '645.7100' });
  });

  it('удержание при отказе без стоимости списывается прежним действием целиком участку', async () => {
    const { service, chainPort, periodService } = build({ warrantyUntil: warranty });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.PENALTY, '50.0000', 1));
    await service.chargeDue(COOP, firstOfDecember);
    expect(chainPort.chargeDue).toHaveBeenCalledWith({ coopname: COOP, username: 'orderer1', braname: 'branch1', order_hash: ORDER, amount: '50.0000 RUB' });
    expect(chainPort.chargePeriod).not.toHaveBeenCalled();
    expect(periodService.ensureClosed).not.toHaveBeenCalled();
  });

  it('итог месяца не рассчитан — строки со стоимостью ждут следующего прохода, удержания списываются', async () => {
    const { service, chainPort, periodService } = build({ warrantyUntil: warranty });
    periodService.ensureClosed.mockRejectedValueOnce(new Error('MARKETPLACE_PERIOD_AMOUNT_INVALID: ноль'));
    await issued(service, ORDER, '10000.0000', '3800.0000', 1);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.PENALTY, '50.0000', 5, { process_hash: ORDER_2 }));
    const res = await service.chargeDue(COOP, firstOfDecember);
    expect(res).toEqual({ charged: 1, failed: 1 });
    expect(chainPort.chargePeriod).not.toHaveBeenCalled();
    expect(chainPort.chargeDue).toHaveBeenCalledTimes(1);
  });

  it('отказ контракта по строке — строка остаётся, остальные идут; MARKETPLACE_DUE_EXCEEDS — тревога в журнал', async () => {
    const { service, chainPort, logger } = build({ warrantyUntil: warranty });
    chainPort.chargePeriod.mockRejectedValueOnce(new Error('MARKETPLACE_DUE_EXCEEDS: больше остатка'));
    await issued(service, ORDER, '10000.0000', '3800.0000', 1);
    await issued(service, ORDER_2, '20000.0000', '7600.0000', 3);
    const res = await service.chargeDue(COOP, firstOfDecember);
    expect(res).toEqual({ charged: 1, failed: 1 });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('учёт разошёлся'));
  });

  it('два участка — два итога месяца, каждый по своим строкам', async () => {
    const { service, periodService } = build({ warrantyUntil: warranty });
    await issued(service, ORDER, '10000.0000', '3800.0000', 1);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, '5000.0000', 3, { process_hash: ORDER_2 }));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '1900.0000', 4, { process_hash: ORDER_2 }));
    // Второй заказ — на другом участке: подменяем участок строки прямо в учёте.
    const row = (service as any).dueStore.rows.get(ORDER_2);
    (service as any).dueStore.rows.set(ORDER_2, { ...row, braname: 'branch2' });
    await service.chargeDue(COOP, firstOfDecember);
    const branches = periodService.ensureClosed.mock.calls.map((c: any[]) => c[1]).sort();
    expect(branches).toEqual(['branch1', 'branch2']);
  });
});

describe('mkt.order.keu.14 — письмо после прогона по ставкам: списано, возвращено, ставка', () => {
  it('одно письмо на пайщика с суммами по итогу месяца', async () => {
    const { service, notifications } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CONSUM, '10000.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 2));
    await service.chargeDue(COOP, new Date('2026-11-30T21:30:00.000Z'));
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'orderer1',
      'obespechitelnaya-chast-spisana',
      expect.objectContaining({ amount: AmountFormatterUtils.formatAmountSafe('3154.2900 RUB'), returnedAmount: '645,71 RUB', ratePercent: '31.54', ordersCount: '1' })
    );
  });

  it('карточка заказа после списания по ставкам: списано и возвращено, сумма — вся обеспечительная часть', async () => {
    const { service } = build({ warrantyUntil: new Date('2026-10-24T10:00:00.000Z') });
    (service as any).claimRepo.findActiveByOrderId = jest.fn(async () => null);
    await service.applyOperation(apply(MarketplaceSecureDueOperation.TO_DUE, '3800.0000', 1));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.CHARGE, '3234.8900', 2, {}, '2026-12-01T00:05:00.000Z'));
    await service.applyOperation(apply(MarketplaceSecureDueOperation.RETURN_DUE, '565.1100', 3, {}, '2026-12-01T00:05:00.000Z'));
    const part = await service.securePartOf({ id: 'o', coopname: COOP, order_hash: ORDER.toUpperCase(), membership_fee: '3800.0000', status: 'RECEIVED' as never });
    expect(part).toMatchObject({ state: 'CHARGED', amount: '3800.0000', charged_amount: '3234.8900', returned_amount: '565.1100' });
  });
});

describe('mkt.order.keu.15 — ставка списания в карточке заказа и заказы, которые созреют к первому числу', () => {
  const NOVEMBER = 2026 * 12 + 11;
  const chargedAt = new Date('2026-11-30T21:30:00.000Z'); // 1 декабря 00:30 по Москве — списание за ноябрь

  it('списанный заказ со стоимостью — ставка итога месяца перед списанием; удержание без стоимости — 100 %', async () => {
    const { service, store } = build({ mirroredPeriod: NOVEMBER });
    store.rows.set(ORDER, {
      order_hash: ORDER, coopname: COOP, username: 'orderer1', braname: 'branch1',
      due_amount: '0.0000', charged_amount: '3154.2900', base_amount: '10000.0000', returned_amount: '645.7100',
      due_from: new Date('2026-11-10T00:00:00.000Z'), charged_at: chargedAt, last_sequence: '1',
    } as never);
    const part = await service.securePartOf({ id: 'o1', coopname: COOP, order_hash: ORDER, membership_fee: '3800.0000', status: 'RECEIVED' as never });
    expect(part).toMatchObject({ state: 'CHARGED', charged_amount: '3154.2900', returned_amount: '645.7100', rate_percent: '31.54' });

    const penalty = 'b'.repeat(64);
    store.rows.set(penalty, {
      order_hash: penalty, coopname: COOP, username: 'orderer1', braname: 'branch1',
      due_amount: '0.0000', charged_amount: '50.0000', base_amount: '0.0000', returned_amount: '0.0000',
      due_from: new Date('2026-11-10T00:00:00.000Z'), charged_at: chargedAt, last_sequence: '2',
    } as never);
    const penaltyPart = await service.securePartOf({ id: 'o2', coopname: COOP, order_hash: penalty, membership_fee: '50.0000', status: 'CANCELLED_BY_ORDERER' as never });
    expect(penaltyPart).toMatchObject({ state: 'CHARGED', rate_percent: '100.00' });
  });

  it('зеркала итога нет (списано до модели) — ставки нет; до списания ставки нет', async () => {
    const { service, store } = build();
    store.rows.set(ORDER, {
      order_hash: ORDER, coopname: COOP, username: 'orderer1', braname: 'branch1',
      due_amount: '0.0000', charged_amount: '3800.0000', base_amount: '10000.0000', returned_amount: '0.0000',
      due_from: new Date('2026-11-10T00:00:00.000Z'), charged_at: chargedAt, last_sequence: '1',
    } as never);
    expect(await service.securePartOf({ id: 'o1', coopname: COOP, order_hash: ORDER, membership_fee: '3800.0000', status: 'RECEIVED' as never }))
      .toMatchObject({ state: 'CHARGED', rate_percent: null });
    store.rows.set(ORDER, { ...store.rows.get(ORDER)!, due_amount: '3800.0000', charged_amount: '0.0000', charged_at: null } as never);
    expect(await service.securePartOf({ id: 'o1', coopname: COOP, order_hash: ORDER, membership_fee: '3800.0000', status: 'RECEIVED' as never }))
      .toMatchObject({ state: 'DUE', rate_percent: null });
  });

  it('созреют к первому числу: выданные строки участка с гарантией до конца месяца; чужой участок, списанные и пустые не входят', async () => {
    const { service, store } = build();
    const row = (hash: string, braname: string, dueFrom: string, due: string, base: string, chargedAt: Date | null = null) => {
      store.rows.set(hash, {
        order_hash: hash, coopname: COOP, username: 'orderer1', braname,
        due_amount: due, charged_amount: '0.0000', base_amount: base, returned_amount: '0.0000',
        due_from: new Date(dueFrom), charged_at: chargedAt, last_sequence: '1',
      } as never);
    };
    row('1'.repeat(64), 'branch1', '2026-11-05T00:00:00.000Z', '3800.0000', '10000.0000');
    row('2'.repeat(64), 'branch1', '2026-11-20T00:00:00.000Z', '7600.0000', '20000.0000');
    row('3'.repeat(64), 'branch1', '2026-12-03T00:00:00.000Z', '1000.0000', '5000.0000'); // гарантия кончится в декабре
    row('4'.repeat(64), 'branch2', '2026-11-05T00:00:00.000Z', '500.0000', '1000.0000'); // чужой участок
    row('5'.repeat(64), 'branch1', '2026-11-05T00:00:00.000Z', '0.0000', '1000.0000'); // уже пусто
    row('6'.repeat(64), 'branch1', '2026-10-05T00:00:00.000Z', '900.0000', '3000.0000', new Date('2026-10-31T21:00:00.000Z')); // списано
    const now = new Date('2026-11-15T12:00:00.000Z');
    expect(await service.ripeningForBranch(COOP, 'branch1', now)).toEqual({ count: 2, turnover: toUnits('30000.0000'), secured: toUnits('11400.0000') });
    expect(await service.ripeningForBranch(COOP, 'branch2', now)).toEqual({ count: 1, turnover: toUnits('1000.0000'), secured: toUnits('500.0000') });
  });
});

