/**
 * Выдача заказа из остатка кооператива дешевле цены прибытия — разница
 * выбывает прочим расходом (`markdown`, o.mkt.loss). Уценка считается при
 * закрывающей подписи оператора от ВЫДАННОГО количества.
 */
import { MarketplaceIssuanceSagaStages } from '~/extensions/marketplace/domain/entities/marketplace-issuance-saga.types';
import { COOP, buildMocks, buildOrder, buildSaga, buildService, signedDoc, stubSignatureChecks } from './issuance-saga.fixture';

const ORDERER = 'orderer2';
const ACT = { registry_id: 1115, order_hash: 'h-stock-1' };

/** Заказ из остатка: продавец — сам кооператив, цена прибытия 250 ₽. */
function setup(reserved: number, issued_arrival_cost: string, fact: { quantity: number; price: string }) {
  const order = buildOrder({
    id: 'order-stock-1',
    order_hash: 'h-stock-1',
    orderer_account: ORDERER,
    supplier_account: COOP,
    offer_id: 'offer-stock-1',
    quantity: 4,
    price_per_unit: '250.0000',
    total_cost: '1000.0000',
  });
  const saga = buildSaga({
    order_id: 'order-stock-1',
    order_hash: 'h-stock-1',
    member_account: ORDERER,
    stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED,
    act1_document: signedDoc(ACT, [ORDERER]),
    fact: { actual_quantity: fact.quantity, actual_unit_price: fact.price, fact_cost: (fact.quantity * Number.parseFloat(fact.price)).toFixed(4) },
  });
  const m = buildMocks({ order, sagas: [saga], warehouse: reserved });
  m.inventoryRepo.finalizeReservedIssue.mockResolvedValue({ released: reserved - fact.quantity, issued_arrival_cost });
  const service = buildService(m);
  stubSignatureChecks(service);
  return { m, service };
}

const issue = (service: any) =>
  service.closeIssuance({ coopname: COOP, operator_account: 'chairkrg', order_id: 'order-stock-1', signed_act: signedDoc(ACT, [ORDERER, 'chairkrg']) });

describe('Выдача остатка кооператива: уценка выбывает прочим расходом', () => {
  it('продано дешевле цены прибытия — разница уходит в расход', async () => {
    // Прибытие 4 × 250 = 1000 ₽, продано 4 × 200 = 800 ₽ → уценка 200 ₽.
    const { m, service } = setup(4, '1000.0000', { quantity: 4, price: '200.0000' });
    await issue(service);
    expect(m.chainPort.markdown).toHaveBeenCalledWith(expect.objectContaining({ coopname: COOP, amount: '200.0000 RUB' }));
  });

  it('уценка считается от выданного, а не от всего резерва', async () => {
    // Выдали 2 из 4: прибытие выданного 2 × 250 = 500 ₽, продано 2 × 200 = 400 ₽.
    const { m, service } = setup(4, '500.0000', { quantity: 2, price: '200.0000' });
    await issue(service);
    expect(m.chainPort.markdown).toHaveBeenCalledWith(expect.objectContaining({ amount: '100.0000 RUB' }));
  });

  it('продано по цене прибытия — расхода нет', async () => {
    const { m, service } = setup(4, '800.0000', { quantity: 4, price: '200.0000' });
    await issue(service);
    expect(m.chainPort.markdown).not.toHaveBeenCalled();
  });

  it('сбой отправки расхода не роняет выдачу, но оставляет след в логе', async () => {
    const { m, service } = setup(4, '1000.0000', { quantity: 4, price: '200.0000' });
    m.chainPort.markdown.mockRejectedValueOnce(new Error('цепь недоступна'));
    // Выдача обязана закрыться: деньги пайщика важнее бухгалтерии остатка.
    await expect(issue(service)).resolves.toBeDefined();
    expect(m.logger.warn).toHaveBeenCalledWith(expect.stringContaining('цепь недоступна'));
  });
});
