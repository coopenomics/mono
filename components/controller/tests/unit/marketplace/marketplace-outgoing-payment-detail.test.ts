/**
 * Unit-тесты разворота выплаты (`marketplaceGetOutgoingPayment`).
 *
 * Разворот собирает картину из трёх источников, и каждый из них может
 * отсутствовать. Инварианты:
 *   - выплата чужого кооператива для совета не существует (null, а не отказ:
 *     чужой идентификатор не должен подтверждаться ответом);
 *   - заказ не найден → order = null, разворот всё равно отдаётся;
 *   - кассирский порт упал → core_payment = null, marketplace-статус остаётся;
 *   - платёж ищется по order_hash — marketplace заводит его с
 *     payment_hash = order_hash, другого ключа у порта нет.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { ...jest.requireActual('~/config/config').default, coopname: 'voskhod' },
}));

import { MarketplaceOutgoingPaymentResolver } from '~/extensions/marketplace/application/resolvers/marketplace-outgoing-payment.resolver';

const paymentOf = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'pay-1',
    coopname: 'voskhod',
    order_hash: 'abc123',
    order_id: 'order-1',
    apl_reception_id: 'apl-1',
    payee_account: 'ant',
    amount: '1000.0000',
    symbol: 'RUB',
    purpose: 'Оплата по договору',
    payout_destination: null,
    withheld_amount: '0.0000',
    status: 'COMPLETED',
    completed_at: null,
    decline_reason: null,
    payout_tx_hash: null,
    core_payment_id: 'core-1',
    created_at: new Date('2026-09-09T22:42:47Z'),
    updated_at: new Date('2026-09-09T22:42:47Z'),
    ...overrides,
  }) as any;

const orderOf = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'order-1',
    quantity: 3,
    unit_of_measure: 'л',
    price_per_unit: '100.0000',
    total_cost: '300.0000',
    accepted_cost: null,
    status: 'RECEIVED',
    ...overrides,
  }) as any;

const makeResolver = (opts: {
  payment?: any;
  order?: any;
  corePage?: any;
  coreThrows?: boolean;
}) => {
  const paymentRepo = {
    findById: jest.fn().mockResolvedValue(opts.payment ?? null),
  } as any;
  const orderRepo = {
    findById: jest.fn().mockResolvedValue(opts.order ?? null),
  } as any;
  const coreGateway = {
    getPayments: opts.coreThrows
      ? jest.fn().mockRejectedValue(new Error('порт недоступен'))
      : jest.fn().mockResolvedValue(opts.corePage ?? { items: [], totalCount: 0, totalPages: 0, currentPage: 1 }),
  } as any;
  const displayService = {
    enrichOne: jest.fn().mockResolvedValue({
      product_name: 'Молоко',
      orderer_name: 'Петров Пётр Петрович',
      delivery_point_name: 'Курганский',
    }),
  } as any;
  const resolver = new MarketplaceOutgoingPaymentResolver(
    paymentRepo,
    orderRepo,
    coreGateway,
    displayService
  );
  return { resolver, paymentRepo, orderRepo, coreGateway, displayService };
};

describe('marketplaceGetOutgoingPayment', () => {
  it('собирает выплату, заказ и запись кассирского реестра', async () => {
    const { resolver, coreGateway } = makeResolver({
      payment: paymentOf(),
      order: orderOf(),
      corePage: {
        items: [
          {
            id: 'core-1',
            status: 'completed',
            quantity: 1000,
            symbol: 'RUB',
            memo: 'Оплата по договору',
            message: null,
            created_at: new Date('2026-09-09T22:00:00Z'),
            completed_at: new Date('2026-09-09T22:42:47Z'),
          },
        ],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      },
    });

    const detail = await resolver.marketplaceGetOutgoingPayment('pay-1');

    expect(detail?.payment.id).toBe('pay-1');
    expect(detail?.order?.product_name).toBe('Молоко');
    expect(detail?.order?.quantity).toBe(3);
    expect(detail?.core_payment?.status).toBe('completed');
    // Платёж ищется по order_hash: marketplace заводит его с этим payment_hash.
    expect(coreGateway.getPayments).toHaveBeenCalledWith(
      { coopname: 'voskhod', hash: 'abc123' },
      expect.objectContaining({ page: 1, limit: 1 })
    );
  });

  it('выплату чужого кооператива не показывает и не подтверждает', async () => {
    const { resolver, orderRepo, coreGateway } = makeResolver({
      payment: paymentOf({ coopname: 'other' }),
      order: orderOf(),
    });

    await expect(resolver.marketplaceGetOutgoingPayment('pay-1')).resolves.toBeNull();
    expect(orderRepo.findById).not.toHaveBeenCalled();
    expect(coreGateway.getPayments).not.toHaveBeenCalled();
  });

  it('несуществующая выплата — null', async () => {
    const { resolver } = makeResolver({ payment: null });
    await expect(resolver.marketplaceGetOutgoingPayment('нет-такой')).resolves.toBeNull();
  });

  it('заказ не найден — разворот отдаётся без него', async () => {
    const { resolver } = makeResolver({ payment: paymentOf(), order: null });
    const detail = await resolver.marketplaceGetOutgoingPayment('pay-1');
    expect(detail?.order).toBeNull();
    expect(detail?.payment.id).toBe('pay-1');
  });

  it('кассирский порт упал — разворот остаётся, core_payment пуст', async () => {
    const { resolver } = makeResolver({
      payment: paymentOf(),
      order: orderOf(),
      coreThrows: true,
    });
    const detail = await resolver.marketplaceGetOutgoingPayment('pay-1');
    expect(detail?.core_payment).toBeNull();
    expect(detail?.order?.product_name).toBe('Молоко');
  });

  it('платежа в реестре кассира ещё нет — core_payment пуст', async () => {
    const { resolver } = makeResolver({ payment: paymentOf(), order: orderOf() });
    const detail = await resolver.marketplaceGetOutgoingPayment('pay-1');
    expect(detail?.core_payment).toBeNull();
  });
});
