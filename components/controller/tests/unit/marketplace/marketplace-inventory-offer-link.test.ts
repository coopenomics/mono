/**
 * Unit-тесты связи позиции склада с предложением.
 *
 * Склад стола администратора открывает по строке карточку предложения и
 * фильтрует позиции по категории, поэтому список наклеек обязан отдавать
 * `offer_id` и `category_id`. Хранит их не наклейка: обычная позиция знает
 * только свой заказ, а предложение и его категория добираются батчем на
 * read-path (там же, где ФИО заказчика и реквизиты ПВЗ).
 *
 * Инварианты:
 *   - позиция обычного заказа → предложение и категория заказа;
 *   - позиция опубликованного остатка → своё предложение публикации
 *     (`published_offer_id`) важнее предложения исходного заказа;
 *   - предложение не нашлось → оба поля пустые, список не падает.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import { MarketplaceInventoryResolver } from '~/extensions/marketplace/application/resolvers/marketplace-inventory.resolver';

const inventoryRow = (over: Record<string, unknown> = {}) =>
  ({
    id: 'inv-1',
    coopname: 'voskhod',
    barcode_value: null,
    barcode_format: null,
    order_id: 'ord-1',
    shipment_id: 'shp-1',
    braname: 'krg',
    status: 'RECEIVED',
    product_name_snapshot: 'Молоко',
    quantity_per_label: 3,
    orderer_account_snapshot: 'ant',
    shelf: null,
    cell_id: null,
    container_id: null,
    received_at: new Date('2026-09-01T10:00:00Z'),
    expiry_date: null,
    received_by_operator_account: 'op',
    labeled_at: null,
    labeled_by_operator_account: null,
    ownership: 'MEMBER',
    origin: 'SUPPLY',
    return_claim_id: null,
    arrival_price: null,
    published_offer_id: null,
    reserved_order_id: null,
    created_at: new Date('2026-09-01T10:00:00Z'),
    updated_at: new Date('2026-09-01T10:00:00Z'),
    ...over,
  }) as any;

const makeResolver = (rows: unknown[], display: Map<string, unknown>) => {
  const inventoryRepo = { list: jest.fn().mockResolvedValue(rows) } as any;
  const orderDisplay = {
    resolveAccountNames: jest.fn().mockResolvedValue(new Map()),
    enrichByOrderIds: jest.fn().mockResolvedValue(display),
  } as any;
  return new MarketplaceInventoryResolver(
    {} as any,
    inventoryRepo,
    { listBranamesForMember: jest.fn().mockResolvedValue([]) } as any,
    orderDisplay
  );
};

const asAdmin = () =>
  ({ username: 'chairman', core_roles: ['Chairman'], marketplace_roles: ['admin'] }) as any;

describe('marketplaceListInventory → предложение позиции', () => {
  it('обычная позиция получает предложение и категорию своего заказа', async () => {
    const resolver = makeResolver(
      [inventoryRow()],
      new Map([['ord-1', { offer_id: 'offer-1', category_id: 2 }]])
    );

    const [dto] = await resolver.marketplaceListInventory(asAdmin(), undefined);

    expect(dto.offer_id).toBe('offer-1');
    expect(dto.category_id).toBe(2);
  });

  it('позиция опубликованного остатка ссылается на предложение публикации', async () => {
    const resolver = makeResolver(
      [inventoryRow({ published_offer_id: 'stock-offer' })],
      new Map([['ord-1', { offer_id: 'offer-1', category_id: 2 }]])
    );

    const [dto] = await resolver.marketplaceListInventory(asAdmin(), undefined);

    expect(dto.offer_id).toBe('stock-offer');
  });

  it('предложение заказа не найдено — поля пустые, список отдаётся', async () => {
    const resolver = makeResolver([inventoryRow()], new Map());

    const [dto] = await resolver.marketplaceListInventory(asAdmin(), undefined);

    expect(dto.offer_id).toBeNull();
    expect(dto.category_id).toBeNull();
  });
});
