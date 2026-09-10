/**
 * Непоставка (задача 99D-16): поставщик принял заказ и за 48 часов не привёз.
 *
 * Кооператив закрывает такой заказ по сроку с полным возвратом резерва и
 * взноса. Без этого резерв заказчика стоял бы бессрочно, а единственным
 * выходом у заказчика был бы отказ с удержанием половины — за вину поставщика.
 */
import { MarketplaceUndeliveredOrderCronService } from '~/extensions/marketplace/application/services/marketplace-undelivered-order-cron.service';
import {
  MARKETPLACE_UNDELIVERED_ORDER_REASON,
  MarketplaceOrderSupplierActionService,
} from '~/extensions/marketplace/application/services/marketplace-order-supplier-action.service';
import { MARKETPLACE_ORDER_DECLINED_BY_SUPPLIER_EVENT } from '~/extensions/marketplace/application/events/marketplace-notification.events';
import { MarketplaceOrderStatuses } from '~/extensions/marketplace/domain/entities/marketplace-order.types';

const COOP = 'voskhod';
const HOUR = 60 * 60 * 1000;

function logger() {
  return { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn(), log: jest.fn() };
}

describe('Крон непоставки: выборка и устойчивость прогона', () => {
  function build() {
    const orderRepo = { listUndelivered: jest.fn(async () => [] as unknown[]) };
    const supplierActions = { expireUndeliveredOrder: jest.fn(async () => ({})) };
    const log = logger();
    const service = new MarketplaceUndeliveredOrderCronService(orderRepo as never, supplierActions as never, log as never);
    return { service, orderRepo, supplierActions, log };
  }

  it('ищет заказы, принятые поставщиком ровно 48 часов назад и раньше', async () => {
    const { service, orderRepo } = build();
    const now = new Date('2026-09-12T12:00:00Z');

    await service.expireUndelivered(COOP, now);

    expect(orderRepo.listUndelivered).toHaveBeenCalledWith(COOP, new Date(now.getTime() - 48 * HOUR), expect.any(Number));
  });

  it('каждый просроченный заказ закрывается по сроку', async () => {
    const { service, orderRepo, supplierActions } = build();
    const orders = [{ order_hash: 'h1' }, { order_hash: 'h2' }];
    orderRepo.listUndelivered.mockResolvedValue(orders);

    const res = await service.expireUndelivered(COOP, new Date());

    expect(res).toEqual({ expired: 2, failed: 0 });
    expect(supplierActions.expireUndeliveredOrder).toHaveBeenCalledTimes(2);
    expect(supplierActions.expireUndeliveredOrder).toHaveBeenCalledWith(orders[0]);
    expect(supplierActions.expireUndeliveredOrder).toHaveBeenCalledWith(orders[1]);
  });

  it('отказ цепи по одному заказу (поставщик успел подписать акт) не останавливает остальные', async () => {
    const { service, orderRepo, supplierActions, log } = build();
    orderRepo.listUndelivered.mockResolvedValue([{ order_hash: 'h1' }, { order_hash: 'h2' }]);
    supplierActions.expireUndeliveredOrder.mockRejectedValueOnce(new Error('Закрыть по сроку можно только заказ, который ещё не набран'));

    const res = await service.expireUndelivered(COOP, new Date());

    expect(res).toEqual({ expired: 1, failed: 1 });
    expect(supplierActions.expireUndeliveredOrder).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('h1'));
  });

  it('сбой выборки не роняет крон', async () => {
    const { service, orderRepo, supplierActions } = build();
    orderRepo.listUndelivered.mockRejectedValue(new Error('db down'));

    const res = await service.expireUndelivered(COOP, new Date());

    expect(res).toEqual({ expired: 0, failed: 0 });
    expect(supplierActions.expireUndeliveredOrder).not.toHaveBeenCalled();
  });
});

describe('Закрытие непоставленного заказа: цепь, остаток предложения, статус, уведомление', () => {
  const order = {
    id: 'o1',
    coopname: COOP,
    order_hash: 'h1',
    offer_id: 'of1',
    quantity: 3,
    orderer_account: 'petrov',
    delivery_braname: 'krasnogorsk',
    package_id: 'pk1',
    package_size: 1,
  };

  function build() {
    const cancelled = { ...order, status: MarketplaceOrderStatuses.CANCELLED_BY_SUPPLIER };
    const orderRepo = { applyStatusTransition: jest.fn(async () => cancelled) };
    const offerRepo = { findByIds: jest.fn(async () => [{ id: 'of1', product_name: 'Мёд' }]) };
    const offerCounters = { onOrderUnblocked: jest.fn(async () => undefined) };
    const chainPort = { expireOrder: jest.fn(async () => ({ processed: { id: 'tx1' } })) };
    const eventBus = { emit: jest.fn() };
    const service = new MarketplaceOrderSupplierActionService(
      orderRepo as never,
      {} as never,
      offerRepo as never,
      offerCounters as never,
      chainPort as never,
      eventBus as never,
      logger() as never
    );
    return { service, orderRepo, offerCounters, chainPort, eventBus };
  }

  it('закрывает заказ по сроку, возвращает единицы в предложение и помечает отменённым поставщиком', async () => {
    const { service, orderRepo, offerCounters, chainPort } = build();

    await service.expireUndeliveredOrder(order as never);

    expect(chainPort.expireOrder).toHaveBeenCalledWith({ coopname: COOP, order_hash: 'h1' });
    expect(offerCounters.onOrderUnblocked).toHaveBeenCalledWith('of1', 3, { id: 'pk1', count: 3 });
    expect(orderRepo.applyStatusTransition).toHaveBeenCalledWith(
      'o1',
      MarketplaceOrderStatuses.CANCELLED_BY_SUPPLIER,
      MARKETPLACE_UNDELIVERED_ORDER_REASON
    );
  });

  it('заказчик получает уведомление с причиной непоставки', async () => {
    const { service, eventBus } = build();

    await service.expireUndeliveredOrder(order as never);

    expect(eventBus.emit).toHaveBeenCalledWith(
      MARKETPLACE_ORDER_DECLINED_BY_SUPPLIER_EVENT,
      expect.objectContaining({ orderer_account: 'petrov', reason: MARKETPLACE_UNDELIVERED_ORDER_REASON })
    );
  });

  it('цепь отказала — статус и счётчики не трогаются', async () => {
    const { service, orderRepo, offerCounters, chainPort } = build();
    chainPort.expireOrder.mockRejectedValueOnce(new Error('Закрыть по сроку можно только заказ, который ещё не набран'));

    await expect(service.expireUndeliveredOrder(order as never)).rejects.toThrow();
    expect(offerCounters.onOrderUnblocked).not.toHaveBeenCalled();
    expect(orderRepo.applyStatusTransition).not.toHaveBeenCalled();
  });
});
