/**
 * Экспресс-приёмка: неверный факт отвергается до любой записи.
 *
 * Прежде партия создавалась и заказы к ней привязывались раньше проверки
 * факта, и отказ «факт больше заказа» оставлял заказы в подготовленной партии —
 * повторная экспресс-приёмка их уже не видела (нашёл внешний слой, 25.09.2026).
 */
import { MarketplaceAplReceptionService } from '~/extensions/marketplace/application/services/marketplace-apl-reception.service';

function makeService() {
  const orders = [
    { id: 'order-1', cycle_id: 'cycle-1', quantity: 4, price_per_unit: '100.0000', total_cost: '400.0000' },
  ];
  const service = Object.create(MarketplaceAplReceptionService.prototype) as any;
  service.orderRepo = {
    list: jest.fn(async () => ({ items: orders, totalCount: 1, totalPages: 1, currentPage: 1 })),
    assignToShipment: jest.fn(),
  };
  service.shipmentRepo = { create: jest.fn() };
  service.assetConfig = { decimals: 4, symbol: 'RUB' };
  service.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return service;
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e: any) {
    return e.code ?? null;
  }
}

describe('экспресс-приёмка — проверка факта до записи', () => {
  it('факт больше заказа — отказ, партия не создаётся, заказы не трогаются', async () => {
    const service = makeService();
    const code = await codeOf(service.createExpress({
      coopname: 'voskhod',
      braname: 'krg',
      offerer_account: 'sidorov',
      operator_account: 'chairkrg',
      fact_quantity_per_order: [{ order_id: 'order-1', fact_quantity: 5 }],
    }));
    expect(code).toBe('MARKETPLACE_ORDER_FACT_EXCEEDS_ORDERED');
    expect(service.shipmentRepo.create).not.toHaveBeenCalled();
    expect(service.orderRepo.assignToShipment).not.toHaveBeenCalled();
  });

  it('дробный или отрицательный факт — тоже до записи', async () => {
    for (const fact of [1.5, -1]) {
      const service = makeService();
      const code = await codeOf(service.createExpress({
        coopname: 'voskhod',
        braname: 'krg',
        offerer_account: 'sidorov',
        operator_account: 'chairkrg',
        fact_quantity_per_order: [{ order_id: 'order-1', fact_quantity: fact }],
      }));
      expect(code).toBe('MARKETPLACE_ORDER_FACT_QUANTITY_INVALID');
      expect(service.shipmentRepo.create).not.toHaveBeenCalled();
    }
  });
});
