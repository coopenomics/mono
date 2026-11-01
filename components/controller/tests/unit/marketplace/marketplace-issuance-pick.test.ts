/**
 * Подбор на выдаче (задача 99D-18): оператор открыл выдачу пайщику и
 * сканирует бокс или этикетку имущества. Сервер сверяет код с заказами окна
 * выдачи и только читает склад. Проверяются этикетка своей выдачи и резерва
 * остатка, чужая этикетка, выданное имущество, другой участок, бокс с
 * имуществом выдачи и без него, неизвестный код.
 */
import {
  MarketplaceIssuancePickTarget,
  MarketplaceIssuancePickVerdict,
} from '~/extensions/marketplace/application/dto/marketplace-issuance-pick.dto';
import { MarketplaceIssuancePickService } from '~/extensions/marketplace/application/services/marketplace-issuance-pick.service';

const COOP = 'voskhod';
const KU = 'pvz1';
const ORDER = 'order-a';
const OTHER = 'order-b';
const EAN = '4600000000017';

function item(over: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    order_id: ORDER,
    reserved_order_id: null,
    braname: KU,
    status: 'LABELED',
    quantity_per_label: 2,
    product_name_snapshot: 'Молоко',
    container_id: 'box-1',
    ...over,
  };
}

function build(found: ReturnType<typeof item> | null, opts: { box?: Record<string, unknown> | null; inBox?: ReturnType<typeof item>[] } = {}) {
  const inventory = {
    findByBarcode: jest.fn().mockResolvedValue(found),
    list: jest.fn().mockImplementation(async (filter: { order_id?: string; reserved_order_id?: string }) =>
      (opts.inBox ?? []).filter((i) => (filter.order_id ? i.order_id === filter.order_id : i.reserved_order_id === filter.reserved_order_id))
    ),
  };
  const box = opts.box === undefined ? { id: 'box-1', code: 'BX-0001', braname: KU } : opts.box;
  const containers = { findByCode: jest.fn().mockResolvedValue(box) };
  const service = new MarketplaceIssuancePickService(inventory as never, containers as never);
  return { service, inventory, containers };
}

describe('подбор на выдаче: этикетка', () => {
  // mkt.pick.happy.01
  it('этикетка имущества выдачи ведёт к заказу и количеству под этикеткой', async () => {
    const { service, inventory } = build(item());
    const r = await service.scan(COOP, KU, [ORDER], ` ${EAN} `);
    expect(inventory.findByBarcode).toHaveBeenCalledWith(COOP, EAN);
    expect(r).toMatchObject({
      target: MarketplaceIssuancePickTarget.LABEL,
      verdict: MarketplaceIssuancePickVerdict.MATCH,
      inventory_id: 'inv-1',
      order_id: ORDER,
      quantity: 2,
      product_name: 'Молоко',
    });
  });

  // mkt.pick.happy.02
  it('этикетка остатка кооператива, зарезервированного под заказ выдачи, ведёт к этому заказу', async () => {
    const { service } = build(item({ order_id: 'origin', reserved_order_id: ORDER }));
    expect(await service.scan(COOP, KU, [ORDER], EAN)).toMatchObject({ verdict: MarketplaceIssuancePickVerdict.MATCH, order_id: ORDER });
  });

  // mkt.pick.break.01
  it('этикетка имущества вне выдачи — «не то имущество»', async () => {
    const { service } = build(item({ order_id: OTHER }));
    expect(await service.scan(COOP, KU, [ORDER], EAN)).toMatchObject({
      target: MarketplaceIssuancePickTarget.LABEL,
      verdict: MarketplaceIssuancePickVerdict.OTHER_ORDER,
      order_id: null,
      product_name: 'Молоко',
    });
  });

  // mkt.pick.break.02
  it('имущество по этикетке уже выдано — числится вне склада', async () => {
    const { service } = build(item({ status: 'ISSUED' }));
    expect(await service.scan(COOP, KU, [ORDER], EAN)).toMatchObject({ verdict: MarketplaceIssuancePickVerdict.NOT_ON_WAREHOUSE, order_id: null });
  });

  // mkt.pick.break.03
  it('этикетка и бокс другого участка — отдельный ответ', async () => {
    expect(await build(item({ braname: 'pvz2' })).service.scan(COOP, KU, [ORDER], EAN)).toMatchObject({
      verdict: MarketplaceIssuancePickVerdict.OTHER_BRANCH,
    });
    const { service } = build(null, { box: { id: 'box-9', code: 'BX-0009', braname: 'pvz2' } });
    expect(await service.scan(COOP, KU, [ORDER], 'BX-0009')).toMatchObject({
      target: MarketplaceIssuancePickTarget.CONTAINER,
      verdict: MarketplaceIssuancePickVerdict.OTHER_BRANCH,
      container_code: 'BX-0009',
    });
  });
});

describe('подбор на выдаче: бокс и неизвестный код', () => {
  // mkt.pick.happy.03
  it('QR бокса и код с его этикетки называют заказы выдачи, которые лежат в боксе', async () => {
    const { service, containers } = build(null, { inBox: [item(), item({ id: 'inv-2', order_id: OTHER, container_id: 'box-2' })] });
    for (const code of [`container:${COOP}:BX-0001`, 'bx-0001']) {
      expect(await service.scan(COOP, KU, [ORDER, OTHER], code)).toMatchObject({
        target: MarketplaceIssuancePickTarget.CONTAINER,
        verdict: MarketplaceIssuancePickVerdict.MATCH,
        container_code: 'BX-0001',
        order_ids: [ORDER],
      });
    }
    expect(containers.findByCode).toHaveBeenCalledWith(COOP, 'BX-0001');
  });

  // mkt.pick.side.01
  it('бокс без имущества выдачи, выданное в боксе и неизвестный код — свой ответ, не ошибка', async () => {
    const empty = build(null, { inBox: [] });
    expect(await empty.service.scan(COOP, KU, [ORDER], 'BX-0001')).toMatchObject({ verdict: MarketplaceIssuancePickVerdict.BOX_EMPTY, order_ids: [] });
    // Выданное из бокса склад в список не отдаёт: фильтр по статусам склада.
    expect(empty.inventory.list).toHaveBeenCalledWith(expect.objectContaining({ status: ['RECEIVED', 'LABELED'] }));
    const unknownBox = build(null, { box: null });
    expect(await unknownBox.service.scan(COOP, KU, [ORDER], 'BX-7777')).toMatchObject({
      target: MarketplaceIssuancePickTarget.CONTAINER,
      verdict: MarketplaceIssuancePickVerdict.UNKNOWN,
    });
    expect(await build(null).service.scan(COOP, KU, [ORDER], 'https://example.org')).toMatchObject({
      target: null,
      verdict: MarketplaceIssuancePickVerdict.UNKNOWN,
    });
  });
});
