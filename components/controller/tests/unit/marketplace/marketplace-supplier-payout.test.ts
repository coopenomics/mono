/**
 * Пакет выплаты поставщику (решение владельца 19.11.2026; реестр
 * marketplace.supplier-payout).
 *
 * Заказы поставщика за сутки объединяются в один пакет — один платёж кассиру.
 * Сумму пакета и удержание долга считает контракт: узел только включает заказы
 * (`addpayout`), отправляет пакет (`sendpayout`), берёт сумму из дельты таблицы
 * `payouts` и после решения кассира закрывает (`closepayout`) или возвращает
 * (`releasepay`) заказы по одному.
 */
jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return {
    ...actual,
    platformSettings: () => ({ coopname: 'voskhod', timezone: 'Europe/Moscow', frontendUrl: 'https://coop.test' }),
  };
});

import { PaymentStatus } from '@coopenomics/innercoop';
import { DomainError } from '@coopenomics/extension-kit';
import { MarketplaceSupplierPayoutService } from '~/extensions/marketplace/application/services/marketplace-supplier-payout.service';
import {
  PAYOUT_ACTIONS_PER_TRANSACTION,
  ordersDative,
  payoutDayStart,
} from '~/extensions/marketplace/application/shared/payout-batch.util';
import {
  MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT,
} from '~/extensions/marketplace/application/events/marketplace-notification.events';
import { MarketplaceOutgoingPaymentRequestDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-outgoing-payment-request.entity';
import type { MarketplaceOutgoingPaymentRequestStatus } from '~/extensions/marketplace/domain/entities/marketplace-outgoing-payment-request.types';

const COOP = 'voskhod';
const NOW = new Date('2026-11-19T12:00:00Z');

const order = (id: string, supplier: string, payout_status: string | null = 'none') =>
  ({
    id,
    order_hash: `h-${id}`,
    supplier_account: supplier,
    offer_id: `offer-${id}`,
    payout_status,
    on_chain_present: true,
  }) as any;

const projectionOf = (patch: Partial<Record<string, unknown>> = {}) =>
  new MarketplaceOutgoingPaymentRequestDomainEntity({
    id: 'pay-1',
    coopname: COOP,
    payment_hash: 'batch-1',
    lines: [
      { order_id: 'o1', order_hash: 'h-o1' },
      { order_id: 'o2', order_hash: 'h-o2' },
    ],
    payee_account: 'supp1',
    amount: '0',
    symbol: 'RUB',
    purpose: 'Оплата по договору № 7',
    payout_destination: null,
    withheld_amount: '0',
    status: 'OPEN' as MarketplaceOutgoingPaymentRequestStatus,
    completed_at: null,
    decline_reason: null,
    core_payment_id: null,
    payout_tx_hash: null,
    settled_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...patch,
  } as any);

function build() {
  const store = new Map<string, MarketplaceOutgoingPaymentRequestDomainEntity>();
  const paymentRepo: any = {
    create: jest.fn(async (input: any) => {
      const p = projectionOf({ payment_hash: input.payment_hash, lines: input.lines, payee_account: input.payee_account, purpose: input.purpose });
      store.set(p.payment_hash, p);
      return p;
    }),
    findByPaymentHash: jest.fn(async (_c: string, hash: string) => store.get(hash) ?? null),
    listAll: jest.fn(async () => [] as MarketplaceOutgoingPaymentRequestDomainEntity[]),
    listUnsettled: jest.fn(async () => [] as MarketplaceOutgoingPaymentRequestDomainEntity[]),
    applyLines: jest.fn(async (_c: string, hash: string, lines: any[]) => {
      const p = store.get(hash);
      if (p) p.lines = lines;
      return p ?? null;
    }),
    applyChainState: jest.fn(async () => null),
    applyCompletion: jest.fn(async (_c: string, hash: string) => {
      const p = store.get(hash) ?? null;
      if (p) p.status = 'COMPLETED';
      return p;
    }),
    applyDecline: jest.fn(async (_c: string, hash: string, reason: string) => {
      const p = store.get(hash) ?? null;
      if (p) {
        p.status = 'DECLINED';
        p.decline_reason = reason;
      }
      return p;
    }),
    applyCorePaymentId: jest.fn(async () => null),
    markSettled: jest.fn(async () => undefined),
    deleteByPaymentHash: jest.fn(async (_c: string, hash: string) => void store.delete(hash)),
  };
  const orderRepo: any = {
    listAwaitingSupplierPayout: jest.fn(async () => [] as any[]),
    findByOrderHashes: jest.fn(async () => [] as any[]),
  };
  const offerRepo = {
    findByIds: jest.fn(async (ids: string[]) => ids.map((id) => ({ id, product_name: `Товар ${id}` }))),
  };
  const chainPort: any = {
    addPayouts: jest.fn(async () => ({})),
    // Контракт после отправки переводит пакет в sent — дельта ставит PENDING и сумму.
    sendPayout: jest.fn(async (_c: string, hash: string) => {
      const p = store.get(hash);
      if (p) p.status = 'PENDING';
      return {};
    }),
    closePayouts: jest.fn(async () => ({})),
    releasePayouts: jest.fn(async () => ({})),
    // Строка пакета в цепи; по умолчанию пакета в цепи нет.
    getPayout: jest.fn(async () => null as any),
  };
  const coreGateway: any = {
    createSystemOutgoingPayment: jest.fn(async () => ({ id: 'core-1' })),
    setPaymentStatus: jest.fn(async () => ({})),
  };
  const supplierSettings = { resolvePayoutMethod: jest.fn(async () => null) };
  const supplierRegistry = {
    findByMember: jest.fn(async () => ({ contract_number: '7', contract_date: '2026-03-15' })),
  };
  const eventBus: any = { emit: jest.fn() };
  const logger = { setContext: jest.fn(), log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const service = new MarketplaceSupplierPayoutService(
    paymentRepo as never,
    orderRepo as never,
    offerRepo as never,
    chainPort as never,
    coreGateway as never,
    supplierSettings as never,
    supplierRegistry as never,
    { symbol: 'RUB', decimals: 4 } as never,
    eventBus as never,
    logger as never
  );
  return { service, store, paymentRepo, orderRepo, offerRepo, chainPort, coreGateway, supplierRegistry, eventBus, logger };
}

/** Отказ контракта — как его отдаёт цепь: `assertion failure with message: КОД: текст`. */
const refusal = (code: string) => new Error(`assertion failure with message: ${code}: отказ контракта`);

/** Строка пакета в цепи. */
const chainRow = (status: string, orders: number) => ({ status, orders, amount: '0.0000 RUB', withheld: '0.0000 RUB' });

/**
 * После включения в цепи дельта ставит пакету сумму, а заказам — pending;
 * строка пакета в цепи открыта и считает включённые заказы. Ни один заказ не
 * включён — строки пакета в цепи нет.
 */
function chainIncludes(ctx: ReturnType<typeof build>, amount: string, pendingIds: string[], allIds: string[], supplier = 'supp1') {
  ctx.chainPort.addPayouts.mockImplementation(async (_c: string, hash: string) => {
    const p = ctx.store.get(hash);
    if (p) p.amount = amount;
    return {};
  });
  ctx.chainPort.getPayout.mockImplementation(async () => (pendingIds.length ? chainRow('open', pendingIds.length) : null));
  ctx.orderRepo.findByOrderHashes.mockImplementation(async () =>
    allIds.map((id) => order(id, supplier, pendingIds.includes(id) ? 'pending' : 'completed'))
  );
}

describe('отсечка суток и подписи', () => {
  const saved = { day: process.env.STAND_DAY_SECONDS, month: process.env.STAND_MONTH_SECONDS, env: process.env.NODE_ENV };
  afterEach(() => {
    process.env.STAND_DAY_SECONDS = saved.day;
    process.env.STAND_MONTH_SECONDS = saved.month;
    process.env.NODE_ENV = saved.env;
  });

  it('стенд со сжатым временем: начало отрезка длиной в сутки стенда', () => {
    process.env.NODE_ENV = 'development';
    process.env.STAND_DAY_SECONDS = '60';
    expect(payoutDayStart(new Date('2026-11-19T12:00:45Z'), 'Europe/Moscow').toISOString()).toBe('2026-11-19T12:00:00.000Z');
  });

  it('в работе: полночь по поясу кооператива', () => {
    process.env.NODE_ENV = 'production';
    // 02:30 по Москве 19.11 — сутки начались в 00:00 МСК = 21:00 UTC 18.11.
    expect(payoutDayStart(new Date('2026-11-18T23:30:00Z'), 'Europe/Moscow').toISOString()).toBe('2026-11-18T21:00:00.000Z');
  });

  it('основание выплаты: «по 1 заказу», «по 21 заказу», «по 6 заказам», «по 11 заказам»', () => {
    expect(ordersDative(1)).toBe('1 заказу');
    expect(ordersDative(21)).toBe('21 заказу');
    expect(ordersDative(6)).toBe('6 заказам');
    expect(ordersDative(11)).toBe('11 заказам');
  });
});

describe('новые пакеты', () => {
  it('заказы двух поставщиков → по пакету на поставщика, заказы включаются в свой пакет', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1'), order('o2', 'supp2'), order('o3', 'supp1')]);
    chainIncludes(ctx, '100.0000', [], []);

    const res = await ctx.service.run(COOP, NOW);

    expect(res.created).toBe(2);
    const calls = ctx.chainPort.addPayouts.mock.calls as unknown as [string, string, string[]][];
    expect(calls.map(([, , hashes]) => hashes)).toEqual(expect.arrayContaining([['h-o1', 'h-o3'], ['h-o2']]));
    expect(new Set(calls.map(([, hash]) => hash)).size).toBe(2);
    const created = ctx.paymentRepo.create.mock.calls.map(([input]: any) => [input.payee_account, input.lines.map((l: any) => l.order_id)]);
    expect(created).toEqual(expect.arrayContaining([['supp1', ['o1', 'o3']], ['supp2', ['o2']]]));
  });

  it('назначение платежа — по договору поставщика с датой заключения', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1')]);
    chainIncludes(ctx, '100.0000', ['o1'], ['o1']);
    await ctx.service.run(COOP, NOW);
    expect(ctx.paymentRepo.create.mock.calls[0][0].purpose).toBe('Оплата по договору № 7 от 15.03.2026');
  });

  it('отсечка: обход спрашивает заказы до начала текущих суток', async () => {
    const ctx = build();
    await ctx.service.run(COOP, NOW);
    const cutoff = ctx.orderRepo.listAwaitingSupplierPayout.mock.calls[0][1] as Date;
    expect(cutoff.getTime()).toBeLessThanOrEqual(NOW.getTime());
  });

  it('у поставщика уже открыт пакет → новый не заводится', async () => {
    const ctx = build();
    // Открытые пакеты обход берёт из незакрытых (выборка по индексу), историю выплат не читает.
    ctx.paymentRepo.listUnsettled.mockResolvedValue([projectionOf({ payee_account: 'supp1' })]);
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1')]);
    const res = await ctx.service.run(COOP, NOW);
    expect(res.created).toBe(0);
    expect(ctx.paymentRepo.create).not.toHaveBeenCalled();
    expect(ctx.paymentRepo.listAll).not.toHaveBeenCalled();
  });

  it('сотня заказов — частями по одной транзакции, все в один пакет', async () => {
    const ctx = build();
    const many = Array.from({ length: PAYOUT_ACTIONS_PER_TRANSACTION * 2 + 5 }, (_, i) => order(`o${i}`, 'supp1'));
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue(many);
    chainIncludes(ctx, '100.0000', many.map((o) => o.id), many.map((o) => o.id));

    await ctx.service.run(COOP, NOW);

    const calls = ctx.chainPort.addPayouts.mock.calls as unknown as [string, string, string[]][];
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map(([, hash]) => hash)).size).toBe(1);
    expect(calls.map(([, , hashes]) => hashes.length)).toEqual([PAYOUT_ACTIONS_PER_TRANSACTION, PAYOUT_ACTIONS_PER_TRANSACTION, 5]);
  });

  it('пакет отправляется кассиру одним платежом на сумму из цепи, задача кассиру одна', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1'), order('o2', 'supp1')]);
    chainIncludes(ctx, '2500.0000', ['o1', 'o2'], ['o1', 'o2']);

    await ctx.service.run(COOP, NOW);

    expect(ctx.chainPort.sendPayout).toHaveBeenCalledTimes(1);
    expect(ctx.coreGateway.createSystemOutgoingPayment).toHaveBeenCalledTimes(1);
    const payment = (ctx.coreGateway.createSystemOutgoingPayment.mock.calls as any[])[0][0];
    expect(payment.quantity).toBe(2500);
    expect(payment.payment_hash).toBe(ctx.paymentRepo.create.mock.calls[0][0].payment_hash);
    expect(ctx.paymentRepo.applyCorePaymentId).toHaveBeenCalledWith(COOP, payment.payment_hash, 'core-1');
    const cashier = ctx.eventBus.emit.mock.calls.filter(([name]) => name === MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT);
    expect(cashier).toHaveLength(1);
    expect(cashier[0][1]).toMatchObject({ orders_count: 2, amount: '2500.0000 RUB', supplier_account: 'supp1' });
  });

  it('заказ, покрытый долгом целиком, в пакет не входит: в списке пакета остаются включённые', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1'), order('o2', 'supp1')]);
    chainIncludes(ctx, '1000.0000', ['o2'], ['o1', 'o2']);

    await ctx.service.run(COOP, NOW);

    const hash = ctx.paymentRepo.create.mock.calls[0][0].payment_hash;
    expect(ctx.paymentRepo.applyLines).toHaveBeenCalledWith(COOP, hash, [{ order_id: 'o2', order_hash: 'h-o2' }]);
    expect(ctx.chainPort.sendPayout).toHaveBeenCalledWith(COOP, hash);
  });

  it('долг покрыл все заказы — пакета в цепи нет: запись удаляется, кассиру ничего', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1')]);
    chainIncludes(ctx, '0', [], ['o1']);

    await ctx.service.run(COOP, NOW);

    expect(ctx.paymentRepo.deleteByPaymentHash).toHaveBeenCalled();
    expect(ctx.chainPort.sendPayout).not.toHaveBeenCalled();
    expect(ctx.coreGateway.createSystemOutgoingPayment).not.toHaveBeenCalled();
  });

  it('сбой второй части включения — пакет отправляется с включёнными, остальные ждут следующего обхода', async () => {
    const ctx = build();
    const many = Array.from({ length: PAYOUT_ACTIONS_PER_TRANSACTION + 3 }, (_, i) => order(`o${i}`, 'supp1'));
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue(many);
    const first = many.slice(0, PAYOUT_ACTIONS_PER_TRANSACTION).map((o) => o.id);
    chainIncludes(ctx, '500.0000', first, many.map((o) => o.id));
    const ok = ctx.chainPort.addPayouts.getMockImplementation()!;
    ctx.chainPort.addPayouts.mockImplementationOnce(ok).mockImplementationOnce(async () => {
      throw new Error('цепь не отвечает');
    });

    await ctx.service.run(COOP, NOW);

    const lines = (ctx.paymentRepo.applyLines.mock.calls as any[])[0][2];
    expect(lines).toHaveLength(PAYOUT_ACTIONS_PER_TRANSACTION);
    expect(ctx.chainPort.sendPayout).toHaveBeenCalledTimes(1);
    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  it('контракт отклонил часть из-за одного заказа — заказы отправляются по одному, пакет получает остальные', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1'), order('o2', 'supp1'), order('o3', 'supp1')]);
    chainIncludes(ctx, '700.0000', ['o1', 'o3'], ['o1', 'o2', 'o3']);
    // Транзакция атомарна: отказ по o2 отклоняет всю часть; по одному цепь принимает o1 и o3.
    ctx.chainPort.addPayouts.mockImplementation(async (_c: string, hash: string, hashes: string[]) => {
      if (hashes.includes('h-o2')) throw refusal('MARKETPLACE_PAYOUT_ALREADY_STARTED');
      const p = ctx.store.get(hash);
      if (p) p.amount = '700.0000';
      return {};
    });

    await ctx.service.run(COOP, NOW);

    const calls = (ctx.chainPort.addPayouts.mock.calls as unknown as [string, string, string[]][]).map(([, , hashes]) => hashes);
    expect(calls).toEqual([['h-o1', 'h-o2', 'h-o3'], ['h-o1'], ['h-o2'], ['h-o3']]);
    const hash = ctx.paymentRepo.create.mock.calls[0][0].payment_hash;
    expect(ctx.paymentRepo.applyLines).toHaveBeenCalledWith(COOP, hash, [
      { order_id: 'o1', order_hash: 'h-o1' },
      { order_id: 'o3', order_hash: 'h-o3' },
    ]);
    expect(ctx.chainPort.sendPayout).toHaveBeenCalledWith(COOP, hash);
  });

  it('цепь не приняла ни одного заказа — запись удаляется сразу, пакет в цепи не ищется', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1'), order('o2', 'supp1')]);
    ctx.chainPort.addPayouts.mockRejectedValue(refusal('MARKETPLACE_PAYOUT_NOT_ACCEPTED'));

    const res = await ctx.service.run(COOP, NOW);

    expect(res.created).toBe(0);
    expect(ctx.paymentRepo.deleteByPaymentHash).toHaveBeenCalledTimes(1);
    expect(ctx.chainPort.getPayout).not.toHaveBeenCalled();
    expect(ctx.chainPort.sendPayout).not.toHaveBeenCalled();
  });

  it.each([
    ['сырой сбой сети', () => new Error('connect ECONNREFUSED')],
    ['отказ узла «цепь недоступна»', () => DomainError.serviceUnavailable('BLOCKCHAIN_UNAVAILABLE', { reason: 'fetch failed' })],
    ['превышение времени ответа цепи', () => DomainError.internal('BLOCKCHAIN_RPC_TIMEOUT', { ms: 5000 })],
  ])('сбой связи с цепью (%s) — исход транзакции неизвестен: по одному не отправляется, запись не удаляется', async (_name, failure) => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1'), order('o2', 'supp1')]);
    ctx.chainPort.addPayouts.mockRejectedValue(failure());
    // Зеркало заказов прежнее, строки пакета узел цепи не отдаёт.
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'none'), order('o2', 'supp1', 'none')]);

    await ctx.service.run(COOP, NOW);

    expect(ctx.chainPort.addPayouts).toHaveBeenCalledTimes(1);
    expect(ctx.chainPort.sendPayout).not.toHaveBeenCalled();
    // Транзакция могла пройти: запись остаётся, по строке пакета в цепи решит довоз.
    expect(ctx.paymentRepo.deleteByPaymentHash).not.toHaveBeenCalled();
  });

  it('отказ контракта, переведённый узлом в отказ с кодом, — тоже отказ: заказы отправляются по одному', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1'), order('o2', 'supp1')]);
    ctx.chainPort.addPayouts.mockRejectedValue(DomainError.badRequest('MARKETPLACE_PAYOUT_NOT_ACCEPTED', { message: 'отказ контракта' }));

    await ctx.service.run(COOP, NOW);

    expect(ctx.chainPort.addPayouts).toHaveBeenCalledTimes(3);
    expect(ctx.paymentRepo.deleteByPaymentHash).toHaveBeenCalledTimes(1);
  });

  it('узел ещё не разобрал блок включения: в цепи заказов больше, чем видит узел — пакет не отправляется и не удаляется', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1'), order('o2', 'supp1')]);
    chainIncludes(ctx, '0', ['o1', 'o2'], ['o1', 'o2']);
    // Зеркало заказов отстало: оба заказа ещё не ждут выплаты.
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'none'), order('o2', 'supp1', 'none')]);

    await ctx.service.run(COOP, NOW);

    expect(ctx.chainPort.sendPayout).not.toHaveBeenCalled();
    expect(ctx.paymentRepo.applyLines).not.toHaveBeenCalled();
    expect(ctx.paymentRepo.deleteByPaymentHash).not.toHaveBeenCalled();
    expect(ctx.coreGateway.createSystemOutgoingPayment).not.toHaveBeenCalled();
  });

  it('узел цепи ещё не отдаёт строку пакета, зеркало заказов не обновлено — запись остаётся до довоза', async () => {
    const ctx = build();
    ctx.orderRepo.listAwaitingSupplierPayout.mockResolvedValue([order('o1', 'supp1')]);
    ctx.chainPort.getPayout.mockResolvedValue(null);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'none')]);

    await ctx.service.run(COOP, NOW);

    expect(ctx.paymentRepo.deleteByPaymentHash).not.toHaveBeenCalled();
    expect(ctx.chainPort.sendPayout).not.toHaveBeenCalled();
  });

  it('обход идёт один: второй вызов во время первого ничего не делает', async () => {
    const ctx = build();
    let release!: () => void;
    ctx.paymentRepo.listUnsettled.mockImplementationOnce(() => new Promise((r) => (release = () => r([]))));
    const first = ctx.service.run(COOP, NOW);
    const second = await ctx.service.run(COOP, NOW);
    release();
    await first;
    expect(second.created).toBe(0);
    expect(ctx.paymentRepo.listUnsettled).toHaveBeenCalledTimes(1);
  });
});

describe('довоз начатых пакетов', () => {
  it('отправленный пакет без платежа в реестре кассира → платёж заводится', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'PENDING', amount: '300.0000' });
    ctx.store.set(p.payment_hash, p);
    ctx.paymentRepo.listUnsettled.mockResolvedValue([p]);
    await ctx.service.resume(COOP);
    expect(ctx.coreGateway.createSystemOutgoingPayment).toHaveBeenCalledTimes(1);
    expect(ctx.chainPort.sendPayout).not.toHaveBeenCalled();
  });

  it('открытый пакет (сбой до отправки) → отправляется', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'OPEN', amount: '300.0000' });
    ctx.store.set(p.payment_hash, p);
    ctx.paymentRepo.listUnsettled.mockResolvedValue([p]);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending'), order('o2', 'supp1', 'pending')]);
    ctx.chainPort.getPayout.mockResolvedValue(chainRow('open', 2));
    await ctx.service.resume(COOP);
    expect(ctx.chainPort.getPayout).toHaveBeenCalledWith(COOP, 'batch-1');
    expect(ctx.chainPort.sendPayout).toHaveBeenCalledWith(COOP, 'batch-1');
  });

  it('открытый пакет, которого в цепи нет → довоз удаляет запись', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'OPEN' });
    ctx.store.set(p.payment_hash, p);
    ctx.paymentRepo.listUnsettled.mockResolvedValue([p]);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'none'), order('o2', 'supp1', 'none')]);
    ctx.chainPort.getPayout.mockResolvedValue(null);
    await ctx.service.resume(COOP);
    expect(ctx.paymentRepo.deleteByPaymentHash).toHaveBeenCalledWith(COOP, 'batch-1');
    expect(ctx.chainPort.sendPayout).not.toHaveBeenCalled();
  });

  it('открытая запись, пакет в цепи уже отправлен кассиру → повторной отправки нет', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'OPEN' });
    ctx.store.set(p.payment_hash, p);
    ctx.paymentRepo.listUnsettled.mockResolvedValue([p]);
    ctx.chainPort.getPayout.mockResolvedValue(chainRow('sent', 2));
    await ctx.service.resume(COOP);
    expect(ctx.chainPort.sendPayout).not.toHaveBeenCalled();
    expect(ctx.paymentRepo.deleteByPaymentHash).not.toHaveBeenCalled();
  });

  it('оплаченный пакет: контракт отклонил закрытие одного заказа — остальные закрываются по одному', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'COMPLETED' });
    ctx.paymentRepo.listUnsettled.mockResolvedValue([p]);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending'), order('o2', 'supp1', 'pending')]);
    ctx.chainPort.closePayouts.mockImplementation(async (_c: string, hashes: string[]) => {
      if (hashes.includes('h-o1')) throw refusal('MARKETPLACE_PAYOUT_NOT_PENDING');
      return {};
    });
    await ctx.service.resume(COOP);
    const calls = (ctx.chainPort.closePayouts.mock.calls as unknown as [string, string[]][]).map(([, hashes]) => hashes);
    expect(calls).toEqual([['h-o1', 'h-o2'], ['h-o1'], ['h-o2']]);
  });

  it('оплаченный пакет с незакрытыми заказами → закрываются только ждущие', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'COMPLETED', amount: '300.0000' });
    ctx.paymentRepo.listUnsettled.mockResolvedValue([p]);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'completed'), order('o2', 'supp1', 'pending')]);
    await ctx.service.resume(COOP);
    expect(ctx.chainPort.closePayouts).toHaveBeenCalledWith(COOP, ['h-o2']);
    expect(ctx.paymentRepo.markSettled).not.toHaveBeenCalled();
  });

  it('оплаченный пакет, все заказы закрыты → пакет отмечается закрытым', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'COMPLETED' });
    ctx.paymentRepo.listUnsettled.mockResolvedValue([p]);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'completed')]);
    await ctx.service.resume(COOP);
    expect(ctx.chainPort.closePayouts).not.toHaveBeenCalled();
    expect(ctx.paymentRepo.markSettled).toHaveBeenCalledWith(COOP, 'batch-1', expect.any(Date));
  });

  it('отклонённый пакет → ждущие заказы возвращаются в ожидание выплаты', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'DECLINED' });
    ctx.paymentRepo.listUnsettled.mockResolvedValue([p]);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending'), order('o2', 'supp1', 'declined')]);
    await ctx.service.resume(COOP);
    expect(ctx.chainPort.releasePayouts).toHaveBeenCalledWith(COOP, ['h-o1']);
  });

  it('сбой одного пакета не останавливает довоз остальных', async () => {
    const ctx = build();
    const a = projectionOf({ payment_hash: 'a', status: 'COMPLETED' });
    const b = projectionOf({ payment_hash: 'b', status: 'DECLINED' });
    ctx.paymentRepo.listUnsettled.mockResolvedValue([a, b]);
    ctx.orderRepo.findByOrderHashes
      .mockRejectedValueOnce(new Error('база недоступна'))
      .mockResolvedValueOnce([order('o1', 'supp1', 'pending')]);
    await ctx.service.resume(COOP);
    expect(ctx.chainPort.releasePayouts).toHaveBeenCalledWith(COOP, ['h-o1']);
  });
});

describe('цепь: дельта пакета и решение кассира', () => {
  it('дельта пакета: сумма, удержание, состояние sent → PENDING; хэш в нижнем регистре', async () => {
    const ctx = build();
    await ctx.service.onPayoutsDelta({
      code: 'marketplace', scope: COOP, table: 'payouts', primary_key: '1', block_num: 10, present: true,
      value: { hash: 'ABCD', status: 'sent', amount: '1500.0000 RUB', withheld: '200.0000 RUB' },
    });
    expect(ctx.paymentRepo.applyChainState).toHaveBeenCalledWith(COOP, 'abcd', {
      amount: '1500.0000',
      withheld_amount: '200.0000',
      status: 'PENDING',
    });
  });

  it('удаление строки пакета и неизвестное состояние — проекция не трогается', async () => {
    const ctx = build();
    await ctx.service.onPayoutsDelta({ code: 'marketplace', scope: COOP, table: 'payouts', primary_key: '1', block_num: 10, present: false });
    await ctx.service.onPayoutsDelta({
      code: 'marketplace', scope: COOP, table: 'payouts', primary_key: '1', block_num: 10, present: true,
      value: { hash: 'ab', status: 'unknown', amount: '1.0000 RUB', withheld: '0.0000 RUB' },
    });
    expect(ctx.paymentRepo.applyChainState).not.toHaveBeenCalled();
  });

  it('кассир подтвердил: пакет оплачен, платёж реестра проведён, заказы закрываются, поставщику уведомление', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'PENDING', amount: '300.0000', core_payment_id: 'core-9' });
    ctx.store.set(p.payment_hash, p);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending'), order('o2', 'supp1', 'pending')]);

    await ctx.service.onPayConfirm({ data: { coopname: COOP, outcome_hash: 'BATCH-1' }, transaction_id: 'tx-1' } as any);

    expect(ctx.paymentRepo.applyCompletion).toHaveBeenCalledWith(COOP, 'batch-1', expect.objectContaining({ payout_tx_hash: 'tx-1' }));
    expect(ctx.coreGateway.setPaymentStatus).toHaveBeenCalledWith({ id: 'core-9', status: PaymentStatus.COMPLETED });
    expect(ctx.chainPort.closePayouts).toHaveBeenCalledWith(COOP, ['h-o1', 'h-o2']);
    const confirmed = ctx.eventBus.emit.mock.calls.find(([name]) => name === MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT);
    expect(confirmed?.[1]).toMatchObject({ orders_count: 2, supplier_account: 'supp1', amount: '300.0000 RUB' });
    expect(confirmed?.[1].item_name).toBe('имущество по 2 заказам: Товар offer-o1, Товар offer-o2');
  });

  it('кассир отказал: заказы возвращаются, платёж реестра отменён, причина по умолчанию', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'PENDING', amount: '300.0000', core_payment_id: 'core-9' });
    ctx.store.set(p.payment_hash, p);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending')]);

    await ctx.service.onPayDecline({ data: { coopname: COOP, outcome_hash: 'batch-1', reason: '' } } as any);

    expect(ctx.coreGateway.setPaymentStatus).toHaveBeenCalledWith({ id: 'core-9', status: PaymentStatus.CANCELLED });
    expect(ctx.chainPort.releasePayouts).toHaveBeenCalledWith(COOP, ['h-o1']);
    const declined = ctx.eventBus.emit.mock.calls.find(([name]) => name === MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT);
    expect(declined?.[1]).toMatchObject({ orders_count: 2, reason: 'причина не указана' });
  });

  it('дельта «оплачен» обработана раньше действия кассира: время и транзакция подтверждения записываются, уведомление одно', async () => {
    const ctx = build();
    // Состояние COMPLETED уже поставила дельта таблицы payouts того же блока.
    const p = projectionOf({ status: 'COMPLETED', amount: '300.0000', completed_at: null });
    ctx.store.set(p.payment_hash, p);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending')]);

    await ctx.service.onPayConfirm({ data: { coopname: COOP, outcome_hash: 'batch-1' }, transaction_id: 'tx-1' } as any);

    expect(ctx.paymentRepo.applyCompletion).toHaveBeenCalledWith(COOP, 'batch-1', expect.objectContaining({ payout_tx_hash: 'tx-1' }));
    expect(ctx.chainPort.closePayouts).toHaveBeenCalledWith(COOP, ['h-o1']);
    expect(ctx.eventBus.emit.mock.calls.filter(([name]) => name === MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT)).toHaveLength(1);
  });

  it('повтор события подтверждения: заказы довозятся, поставщик второй раз не уведомляется', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'COMPLETED', amount: '300.0000', completed_at: NOW });
    ctx.store.set(p.payment_hash, p);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending')]);

    await ctx.service.onPayConfirm({ data: { coopname: COOP, outcome_hash: 'batch-1' }, transaction_id: 'tx-1' } as any);

    expect(ctx.chainPort.closePayouts).toHaveBeenCalledWith(COOP, ['h-o1']);
    expect(ctx.eventBus.emit).not.toHaveBeenCalled();
  });

  it('дельта «отклонён» обработана раньше действия кассира: причина записывается, уведомление одно; повтор — без уведомления', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'DECLINED', amount: '300.0000', decline_reason: null });
    ctx.store.set(p.payment_hash, p);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending')]);
    const event = { data: { coopname: COOP, outcome_hash: 'batch-1', reason: 'Неверные реквизиты' } } as any;

    await ctx.service.onPayDecline(event);
    expect(ctx.paymentRepo.applyDecline).toHaveBeenCalledWith(COOP, 'batch-1', 'Неверные реквизиты');
    expect(p.decline_reason).toBe('Неверные реквизиты');

    await ctx.service.onPayDecline(event);
    expect(ctx.eventBus.emit.mock.calls.filter(([name]) => name === MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT)).toHaveLength(1);
    expect(ctx.chainPort.releasePayouts).toHaveBeenCalledTimes(2);
  });

  it('подтверждение по неизвестному пакету — без действий в цепи и уведомлений', async () => {
    const ctx = build();
    await ctx.service.onPayConfirm({ data: { coopname: COOP, outcome_hash: 'нет' }, transaction_id: 'tx' } as any);
    expect(ctx.chainPort.closePayouts).not.toHaveBeenCalled();
    expect(ctx.eventBus.emit).not.toHaveBeenCalled();
  });

  it('сбой закрытия заказов не роняет подтверждение: поставщик получает уведомление, заказы довозит обход', async () => {
    const ctx = build();
    const p = projectionOf({ status: 'PENDING', amount: '300.0000' });
    ctx.store.set(p.payment_hash, p);
    ctx.orderRepo.findByOrderHashes.mockResolvedValue([order('o1', 'supp1', 'pending')]);
    ctx.chainPort.closePayouts.mockRejectedValueOnce(new Error('цепь не отвечает'));
    await ctx.service.onPayConfirm({ data: { coopname: COOP, outcome_hash: 'batch-1' }, transaction_id: 'tx' } as any);
    expect(ctx.paymentRepo.markSettled).not.toHaveBeenCalled();
    expect(ctx.eventBus.emit).toHaveBeenCalledWith(MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT, expect.anything());
  });
});
