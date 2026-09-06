/**
 * Недовыдача (паевая модель): при закрывающей подписи оператора выданное
 * уходит пайщику, невыданное отделяется в обезличенный остаток кооператива —
 * по ВЫДАННОМУ количеству, а не по заказанному. Сбой склада выдачу не роняет.
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
