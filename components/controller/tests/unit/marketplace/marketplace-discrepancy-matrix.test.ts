/**
 * Матрица расхождений на выдаче (паевая модель): факт фиксируется оператором
 * у стойки (`fixFact`), снапшот с признаком расхождения ложится на заказ при
 * закрывающей подписи. Количество и цена расходятся по отдельности и вместе;
 * денежный итог считается от фактического количества по фактической цене.
 */
import { MarketplaceIssuanceSagaStages } from '~/extensions/marketplace/domain/entities/marketplace-issuance-saga.types';
import { COOP, buildMocks, buildOrder, buildSaga, buildService, signedDoc, stubSignatureChecks } from './issuance-saga.fixture';

/**
 * `accepted` — сколько физически принято на склад по заказу. Недоприём
 * задаётся именно им: заказ остаётся на 10, а на складе, скажем, 9.
 */
async function issueWith(accepted: number, actual_quantity: number, actual_unit_price: string, orderOverrides = {}) {
  const order = buildOrder(orderOverrides);
  const m = buildMocks({ order, warehouse: accepted });
  const service = buildService(m);
  stubSignatureChecks(service);
  const { saga } = await service.fixFact({ coopname: COOP, operator_account: 'chairkrg', order_id: 'order-1', actual_quantity, actual_unit_price });
  // Доводим до закрытия: снапшот на заказе — то, что увидят заказчик и учёт.
  const memberAct = signedDoc({ registry_id: 1115, order_hash: 'h-order-1' }, ['orderer1']);
  m.sagaStore.set(saga.id, buildSaga({ ...(saga as any), stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED, act1_document: memberAct }));
  await service.closeIssuance({ coopname: COOP, operator_account: 'chairkrg', order_id: 'order-1', signed_act: signedDoc({ registry_id: 1115, order_hash: 'h-order-1' }, ['orderer1', 'chairkrg']) });
  const [, patch] = m.orderRepo.applyIssuanceClosed.mock.calls[0];
  return patch.issuance_fact as { actual_quantity: number; fact_unit_price: string; fact_cost: string; diff_state: string };
}

describe('Расхождения на выдаче: количество и цена по отдельности', () => {
  it('выдано ровно заказанное по цене заказа → расхождения нет', async () => {
    const fact = await issueWith(10, 10, '100.0000');
    expect(fact.fact_cost).toBe('1000.0000');
    expect(fact.diff_state).toBe('equal');
  });

  it('недовыдача: принято 10, выдано 9 → стоимость меньше заказа', async () => {
    const fact = await issueWith(10, 9, '100.0000');
    expect(fact.actual_quantity).toBe(9);
    expect(fact.fact_cost).toBe('900.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('недоприём: принято 9 из 10 — выдать можно только принятое', async () => {
    await expect(issueWith(9, 10, '100.0000')).rejects.toThrow(/больше, чем принято/);
    const fact = await issueWith(9, 9, '100.0000');
    expect(fact.fact_cost).toBe('900.0000');
  });

  it('цена снижена при том же количестве → стоимость меньше заказа', async () => {
    const fact = await issueWith(10, 10, '90.0000');
    expect(fact.fact_unit_price).toBe('90.0000');
    expect(fact.fact_cost).toBe('900.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('цена повышена при том же количестве → стоимость больше заказа', async () => {
    const fact = await issueWith(10, 10, '110.0000');
    expect(fact.fact_cost).toBe('1100.0000');
    expect(fact.diff_state).toBe('more');
  });
});

describe('Расхождения на выдаче: количество и цена одновременно', () => {
  it('недовыдача и снижение цены складываются в одну сторону', async () => {
    const fact = await issueWith(10, 9, '90.0000');
    expect(fact.fact_cost).toBe('810.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('недоприём и снижение цены: считается от принятого, не от заказа', async () => {
    const fact = await issueWith(9, 9, '90.0000');
    expect(fact.fact_cost).toBe('810.0000');
  });

  it('выдано меньше, но дороже — стоимость всё ещё ниже заказа', async () => {
    const fact = await issueWith(10, 9, '105.0000');
    expect(fact.fact_cost).toBe('945.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('взаимная компенсация: 9 по 111,1111 ₽ — расхождение по количеству есть, по деньгам нет', async () => {
    // 9 × 111.1111 = 999.9999 → после округления к 4 знакам ниже заказа на копейку:
    // расхождение по деньгам считается точно, а не «на глаз».
    const fact = await issueWith(10, 9, '111.1111');
    expect(fact.actual_quantity).toBe(9);
    expect(fact.fact_cost).toBe('999.9999');
    expect(fact.diff_state).toBe('less');
  });
});

describe('Отпуск упаковкой: цена относится к упаковке, а не к содержимому', () => {
  // Заказ 10 упаковок по 0,1 кг (1 кг) по 100 ₽ за упаковку = 1000 ₽; факт
  // хранится в базовой единице (кг), цена — за упаковку.
  const packaged = { unit_of_measure: 'kilogram', package_size: 0.1, quantity: 1, price_per_unit: '100.0000', total_cost: '1000.0000' };

  it('недовыдача упаковками: 4 упаковки вместо 10 → 400 ₽', async () => {
    const fact = await issueWith(1, 0.4, '100.0000', packaged);
    expect(fact.fact_cost).toBe('400.0000');
    expect(fact.diff_state).toBe('less');
  });
});
