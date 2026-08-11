/**
 * Возвращённое имущество попадает на склад участка.
 *
 * Приём гарантийного возврата состоит из двух частей: деньги пайщику
 * (compensating forward на цепи) и само имущество (позиция обезличенного
 * остатка кооператива на складе КУ). Вторая часть выполняется best-effort —
 * сбой складского учёта не откатывает уже проведённые деньги, — и именно
 * поэтому её отказ виден только в логе.
 *
 * Инцидент 2026-08-10: в партию позиции писался составной маркер
 * `return:<id заявления>`, а колонка хранит uuid поставки. Вставка падала на
 * типе, ошибка гасилась, и наружу это выглядело как принятый возврат без
 * имущества: деньги вернулись, остаток кооператива не появился, списывать
 * стало нечего — вся ветка списания оставалась недостижимой.
 *
 * Тест держит две вещи: позиция создаётся с настоящей партией, а когда партии
 * нет — отказ громкий (предупреждение), а не молчаливое исчезновение.
 */
import { MarketplaceReturnClaimService } from '~/extensions/marketplace/application/services/marketplace-return-claim.service';

const COOP = 'voskhod';
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ORIGIN_SHIPMENT = '22222222-2222-4222-8222-222222222222';
const ORDER_SHIPMENT = '33333333-3333-4333-8333-333333333333';
const CLAIM_ID = '44444444-4444-4444-8444-444444444444';

const claim = {
  id: CLAIM_ID,
  coopname: COOP,
  order_id: ORDER_ID,
  orderer_account: 'ekaterina',
  actual_quantity: 3,
  fact_cost: '300.0000',
} as never;

/**
 * `originShipment` — партия исходной позиции на складе (null = позиции нет),
 * `orderShipment` — партия самого заказа (null = заказ пришёл не поставкой).
 */
function buildService(originShipment: string | null, orderShipment: string | null) {
  const inventoryRepo = {
    list: jest.fn().mockImplementation(async (filter: Record<string, unknown>) => {
      if (originShipment && filter.order_id === ORDER_ID) {
        return [
          {
            shipment_id: originShipment,
            arrival_price: '100.0000',
            expiry_date: null,
          },
        ];
      }
      return [];
    }),
    create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
  };

  const orderRepo = {
    findById: jest.fn().mockResolvedValue({
      id: ORDER_ID,
      coopname: COOP,
      offer_id: 'offer-1',
      price_per_unit: '100.0000',
      shipment_id: orderShipment,
    }),
  };

  const offerRepo = {
    findById: jest.fn().mockResolvedValue({ product_name: 'Берёзовый сок', shelf_life_days: null }),
  };

  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };

  const service = new MarketplaceReturnClaimService(
    {} as never,
    orderRepo as never,
    offerRepo as never,
    inventoryRepo as never,
    {} as never,
    { symbol: 'RUB', decimals: 4 } as never,
    {} as never,
    {} as never,
    {} as never,
    logger as never
  );

  return { service, inventoryRepo, logger };
}

/** Зачисление — приватный шаг приёма возврата, вызываем его точечно. */
const restock = (service: MarketplaceReturnClaimService) =>
  (service as never as {
    restockReturnedItem: (c: unknown, b: string, a: string, at: Date) => Promise<void>;
  }).restockReturnedItem(claim, 'krg', 'chairkrg', new Date('2026-08-10T12:00:00Z'));

describe('Приём возврата: имущество возвращается на склад участка', () => {
  it('позиция создаётся с партией исходной поставки и принадлежит кооперативу', async () => {
    const { service, inventoryRepo } = buildService(ORIGIN_SHIPMENT, ORDER_SHIPMENT);

    await restock(service);

    expect(inventoryRepo.create).toHaveBeenCalledTimes(1);
    const created = inventoryRepo.create.mock.calls[0][0];
    expect(created.shipment_id).toBe(ORIGIN_SHIPMENT);
    expect(created.ownership).toBe('COOP');
    expect(created.status).toBe('RECEIVED');
    expect(created.quantity_per_label).toBe(3);
    expect(created.braname).toBe('krg');
  });

  it('исходной позиции нет — берётся партия самого заказа', async () => {
    const { service, inventoryRepo } = buildService(null, ORDER_SHIPMENT);

    await restock(service);

    expect(inventoryRepo.create.mock.calls[0][0].shipment_id).toBe(ORDER_SHIPMENT);
  });

  it('партия — настоящий uuid, а не составной маркер возврата', async () => {
    // Регресс инцидента: `return:<id>` в колонку uuid не влезал, вставка
    // падала, и имущество исчезало из учёта молча.
    const { service, inventoryRepo } = buildService(ORIGIN_SHIPMENT, ORDER_SHIPMENT);

    await restock(service);

    const { shipment_id } = inventoryRepo.create.mock.calls[0][0];
    expect(String(shipment_id)).not.toContain('return:');
    expect(String(shipment_id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('партии нет нигде — позиция не создаётся, но отказ виден в логе', async () => {
    const { service, inventoryRepo, logger } = buildService(null, null);

    await restock(service);

    expect(inventoryRepo.create).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('не зачислен в остаток'));
  });

  it('заказ не найден — молча не создаём чужую позицию', async () => {
    const { service, inventoryRepo, logger } = buildService(ORIGIN_SHIPMENT, ORDER_SHIPMENT);
    (service as never as { orderRepo: { findById: jest.Mock } }).orderRepo.findById.mockResolvedValue(
      null
    );

    await restock(service);

    expect(inventoryRepo.create).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('не найден'));
  });
});
