/**
 * Цена прибытия: во столько имущество обошлось кооперативу при приёмке.
 *
 * Оператор вправе принять партию дешевле заказанной — привезли не то качество
 * или не ту комплектность. Контракт при закрытии приёмки приходует имущество
 * на счёт материалов ровно по факту акта (`o.mkt.purch` считает
 * `actual_quantity × actual_unit_price`). Складская карточка обязана числить
 * ту же цену: если она сохранит цену заказа, выбытие при выдаче окажется
 * больше поступления, и счёт материалов уйдёт в минус при физически целом
 * остатке (инцидент 2026-08-12: −500 ₽ на заказе 10 × 250 ₽, принятом как
 * 9 × 200 ₽).
 *
 * От цены прибытия считаются ещё две вещи: потолок цены перепубликации
 * остатка (дороже прибытия продавать нельзя) и уценка при выдаче остатка.
 */
import { MarketplaceAplReceptionService } from '~/extensions/marketplace/application/services/marketplace-apl-reception.service';

const COOP = 'voskhod';
const ORDER_ID = 'order-1';
const SHIPMENT_ID = 'shipment-1';

/** Заказ: 10 единиц по 250 ₽ — то, что пайщик оплатил при оформлении. */
const ORDER = {
  id: ORDER_ID,
  coopname: COOP,
  offer_id: 'offer-1',
  orderer_account: 'ekaterina',
  delivery_braname: 'krg',
  quantity: 10,
  price_per_unit: '250.0000',
  unit_of_measure: 'piece',
} as never;

/**
 * @param fact — что оператор проставил в акте приёмки: сколько принято и по
 *   какой цене (цена не задана — принято по цене заказа).
 */
function buildService(fact: { fact_quantity: number; fact_unit_price?: string }) {
  const created: Record<string, unknown>[] = [];

  const inventoryRepo = {
    countByOrder: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(async (row: Record<string, unknown>) => {
      created.push(row);
      return { id: `inv-${created.length}` };
    }),
  };

  const offerRepo = {
    findByIds: jest.fn().mockResolvedValue([
      { id: 'offer-1', product_name: 'Берёзовый сок', shelf_life_days: 0 },
    ]),
  };

  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };

  // Сервис приёмки собирается из полутора десятков зависимостей, но
  // оприходование на склад пользуется только тремя — остальные не трогаются.
  const service = Object.create(MarketplaceAplReceptionService.prototype) as MarketplaceAplReceptionService;
  Object.assign(service, { inventoryRepo, offerRepo, logger });

  const reception = {
    id: 'apl-1',
    coopname: COOP,
    braname: 'krg',
    shipment_id: SHIPMENT_ID,
    created_by_operator_account: 'chairkrg',
    chairman_signed_at: new Date('2026-08-12T06:00:00Z'),
    fact_quantity_per_order: [{ order_id: ORDER_ID, ...fact }],
  } as never;

  return { service, reception, created, inventoryRepo };
}

/** Оприходование — приватный шаг закрытия приёмки, вызываем точечно. */
const materialize = (service: MarketplaceAplReceptionService, reception: unknown) =>
  (
    service as never as {
      materializeInventory: (r: unknown, orders: unknown[]) => Promise<void>;
    }
  ).materializeInventory(reception, [ORDER]);

describe('Оприходование на склад: цена прибытия', () => {
  it('принято дешевле заказанного — на складе цена приёмки, а не цена заказа', async () => {
    const { service, reception, created } = buildService({
      fact_quantity: 9,
      fact_unit_price: '200.0000',
    });

    await materialize(service, reception);

    expect(created).toHaveLength(1);
    expect(created[0].arrival_price).toBe('200.0000');
    expect(created[0].quantity_per_label).toBe(9);
  });

  it('цена в акте не проставлена — принято по цене заказа', async () => {
    const { service, reception, created } = buildService({ fact_quantity: 10 });

    await materialize(service, reception);

    expect(created[0].arrival_price).toBe('250.0000');
  });

  it('склад числит ровно то, что оприходовал контракт', async () => {
    // Контракт кладёт на счёт материалов fact_quantity × fact_unit_price.
    // Складская карточка обязана давать ту же сумму — иначе выбытие при
    // выдаче превысит поступление.
    const { service, reception, created } = buildService({
      fact_quantity: 9,
      fact_unit_price: '200.0000',
    });

    await materialize(service, reception);

    const onWarehouse =
      Number(created[0].quantity_per_label) * Number.parseFloat(String(created[0].arrival_price));
    expect(onWarehouse).toBe(1800);
  });
});
