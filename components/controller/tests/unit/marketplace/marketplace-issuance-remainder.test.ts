/**
 * Недовыдача (паевая модель): при закрывающей подписи оператора выданное
 * уходит пайщику, невыданное отделяется в обезличенный остаток кооператива —
 * по ВЫДАННОМУ количеству, а не по заказанному. Сбой склада выдачу не роняет.
 *
 * Здесь же — счётчики предложения на выдаче: заблокированное заказом обязано
 * стать выданным, иначе предложение вечно показывает выданное как «в
 * заказах». У заказа из остатка кооператива невыданный резерв возвращается в
 * свободное того же предложения — позиции остались на складе и в каталоге.
 */
import { MarketplaceIssuanceSagaStages } from '~/extensions/marketplace/domain/entities/marketplace-issuance-saga.types';
import { COOP, buildMocks, buildOrder, buildSaga, buildService, signedDoc, stubSignatureChecks } from './issuance-saga.fixture';

const ORDERER = 'ekaterina';
const ACT = { registry_id: 1115, order_hash: 'h-order-1' };

/** Заказ поставщика (не из остатка): 10 единиц, принято 9, выдаётся меньше. */
function setup(actual_quantity: number) {
  const order = buildOrder({ orderer_account: ORDERER, price_per_unit: '250.0000', total_cost: '2500.0000' });
  const saga = buildSaga({
    member_account: ORDERER,
    stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED,
    act1_document: signedDoc(ACT, [ORDERER]),
    fact: { actual_quantity, actual_unit_price: '200.0000', fact_cost: (actual_quantity * 200).toFixed(4) },
  });
  const m = buildMocks({ order, sagas: [saga], warehouse: 9 });
  m.inventoryRepo.detachRemainderToStock.mockResolvedValue(9 - actual_quantity);
  const service = buildService(m);
  stubSignatureChecks(service);
  return { m, service };
}

const close = (service: any) =>
  service.closeIssuance({ coopname: COOP, operator_account: 'chairkrg', order_id: 'order-1', signed_act: signedDoc(ACT, [ORDERER, 'chairkrg']) });

describe('Недовыдача: имущество остаётся кооперативу, а не пайщику', () => {
  it('выдано меньше принятого — остаток отделяется в собственность кооператива', async () => {
    // Принято 9, выдано 8: одна единица обязана уйти в обезличенный остаток.
    const { m, service } = setup(8);
    await close(service);
    expect(m.inventoryRepo.detachRemainderToStock).toHaveBeenCalledWith(
      COOP,
      'order-1',
      // Ключевой аргумент: отделяем по ВЫДАННОМУ количеству. Передать сюда
      // заказанное — и остаток не отделится вовсе, имущество останется
      // числиться за пайщиком, который его не получал.
      8,
      expect.any(String)
    );
  });

  it('выдано всё принятое — отделять нечего, но склад всё равно закрывается', async () => {
    // Вызов обязан быть и здесь: он же переводит выданные позиции в ISSUED.
    const { m, service } = setup(9);
    await close(service);
    expect(m.inventoryRepo.detachRemainderToStock).toHaveBeenCalledWith(COOP, 'order-1', 9, expect.any(String));
  });

  it('сбой склада не срывает выдачу — деньги пайщика важнее сводного учёта', async () => {
    const { m, service } = setup(8);
    m.inventoryRepo.detachRemainderToStock.mockRejectedValueOnce(new Error('склад недоступен'));
    // Акт уже подписан обеими сторонами и ушёл на цепь: откатывать его из-за
    // складской записи нельзя, расхождение разбирают ручной сверкой.
    await expect(close(service)).resolves.toBeDefined();
    expect(m.logger.warn).toHaveBeenCalledWith(expect.stringContaining('склад недоступен'));
  });
});

describe('Счётчики предложения на выдаче: заблокированное становится выданным', () => {
  it('заказ поставщика: выбывает принятое кооперативом, недопоставка возвращается поставщику', async () => {
    // Заказано 10, привезли 9, выдано 8. Одна единица ушла в обезличенный
    // остаток КУ — она уже оплачена поставщику и продаётся предложением
    // кооператива, поэтому выбывает. Ещё одну поставщик просто не привёз: она
    // так и стоит у него и снова доступна к заказу.
    const { m, service } = setup(8);
    await close(service);
    expect(m.offerCounters.onOrderConsumed).toHaveBeenCalledWith('offer-1', 9, undefined);
    expect(m.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 1, undefined);
  });

  it('поставка полная — поставщику не возвращается ничего', async () => {
    // Принято 9 из 9 заказанных: недопоставки нет, весь объём выбывает.
    const order = buildOrder({ orderer_account: ORDERER, quantity: 9 });
    const saga = buildSaga({
      member_account: ORDERER,
      stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED,
      act1_document: signedDoc(ACT, [ORDERER]),
      fact: { actual_quantity: 8, actual_unit_price: '200.0000', fact_cost: '1600.0000' },
    });
    const m = buildMocks({ order, sagas: [saga], warehouse: 9 });
    m.inventoryRepo.detachRemainderToStock.mockResolvedValue(1);
    const service = buildService(m);
    stubSignatureChecks(service);

    await close(service);
    expect(m.offerCounters.onOrderConsumed).toHaveBeenCalledWith('offer-1', 9, undefined);
    expect(m.offerCounters.onOrderUnblocked).not.toHaveBeenCalled();
  });

  it('заказ из остатка: выданное становится выданным, освобождённый резерв — снова свободным', async () => {
    const order = buildOrder({ orderer_account: ORDERER, supplier_account: COOP, quantity: 10 });
    const saga = buildSaga({
      member_account: ORDERER,
      stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED,
      act1_document: signedDoc(ACT, [ORDERER]),
      fact: { actual_quantity: 7, actual_unit_price: '100.0000', fact_cost: '700.0000' },
    });
    const m = buildMocks({ order, sagas: [saga], warehouse: 10 });
    m.inventoryRepo.finalizeReservedIssue.mockResolvedValue({ released: 3, issued_arrival_cost: '700.0000' });
    const service = buildService(m);
    stubSignatureChecks(service);

    await close(service);
    expect(m.offerCounters.onOrderConsumed).toHaveBeenCalledWith('offer-1', 7, undefined);
    expect(m.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 3, undefined);
  });

  it('отпуск упаковкой: движение идёт и по упаковке заказа, целыми упаковками', async () => {
    const order = buildOrder({
      orderer_account: ORDERER,
      supplier_account: COOP,
      quantity: 5, // 10 упаковок по 0,5 л
      package_size: 0.5,
      package_id: 'pkg-0.5',
      unit_of_measure: 'liter',
    });
    const saga = buildSaga({
      member_account: ORDERER,
      stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED,
      act1_document: signedDoc(ACT, [ORDERER]),
      fact: { actual_quantity: 4, actual_unit_price: '70.0000', fact_cost: '560.0000' },
    });
    const m = buildMocks({ order, sagas: [saga], warehouse: 5 });
    m.inventoryRepo.finalizeReservedIssue.mockResolvedValue({ released: 1, issued_arrival_cost: '560.0000' });
    const service = buildService(m);
    stubSignatureChecks(service);

    await close(service);
    expect(m.offerCounters.onOrderConsumed).toHaveBeenCalledWith('offer-1', 4, { id: 'pkg-0.5', count: 8 });
    expect(m.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 1, { id: 'pkg-0.5', count: 2 });
  });

  it('сбой счётчика не срывает выдачу — акт уже на цепи', async () => {
    const { m, service } = setup(8);
    m.offerCounters.onOrderConsumed.mockRejectedValueOnce(new Error('счётчик недоступен'));
    await expect(close(service)).resolves.toBeDefined();
    expect(m.logger.warn).toHaveBeenCalledWith(expect.stringContaining('счётчик недоступен'));
  });
});
