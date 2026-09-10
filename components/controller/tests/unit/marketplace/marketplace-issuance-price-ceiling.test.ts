/**
 * Цена при выдаче (решение владельца 10.09.2026): снизить можно, поднять
 * нельзя. Имущество числится на счёте 10 по цене прибытия из акта приёмки;
 * выдача дешевле закрывается уценкой (markdown, Дт 91 / Кт 10), иначе разница
 * зависла бы на складе, которого физически уже нет. Для повышения доходной
 * проводки в модели нет — поэтому отказ ещё на фиксации факта у стойки.
 */
import { MarketplaceIssuanceSagaStages } from '~/extensions/marketplace/domain/entities/marketplace-issuance-saga.types';
import { COOP, buildMocks, buildOrder, buildSaga, buildService, signedDoc, stubSignatureChecks } from './issuance-saga.fixture';

const ORDERER = 'orderer1';
const ACT = { registry_id: 1115, order_hash: 'h-order-1' };

const fix = (service: any, actual_unit_price: string, actual_quantity = 10) =>
  service.fixFact({ coopname: COOP, operator_account: 'chairkrg', order_id: 'order-1', actual_quantity, actual_unit_price });

describe('Цена при выдаче: только снижение (fixFact)', () => {
  it('заказ поставщика: цена выше цены прибытия — отказ, заявление не формируется', async () => {
    const m = buildMocks({ arrivalPrice: '90.0000' });
    await expect(fix(buildService(m), '95.0000')).rejects.toThrow(/можно только снизить/);
    expect(m.documentPort.generate).not.toHaveBeenCalled();
  });

  it('заказ поставщика: цена прибытия ниже цены заказа — потолок именно цена прибытия, а не цена заказа', async () => {
    // Приняли со скидкой по 90 при цене заказа 100: выдать по 100 значило бы
    // списать со склада больше, чем на него пришло.
    const m = buildMocks({ arrivalPrice: '90.0000' });
    await expect(fix(buildService(m), '100.0000')).rejects.toThrow(/не выше 90.0000/);
  });

  it('заказ поставщика: цена ниже цены прибытия — факт принимается', async () => {
    const m = buildMocks({ arrivalPrice: '90.0000' });
    await expect(fix(buildService(m), '80.0000')).resolves.toBeDefined();
  });

  it('заказ поставщика без цены прибытия на складе: потолок — цена заказа', async () => {
    const m = buildMocks();
    await expect(fix(buildService(m), '100.0100')).rejects.toThrow(/можно только снизить/);
    await expect(fix(buildService(buildMocks()), '100.0000')).resolves.toBeDefined();
  });

  it('заказ из остатка: цена выше цены заказа — отказ', async () => {
    const m = buildMocks({ order: buildOrder({ supplier_account: COOP }) });
    await expect(fix(buildService(m), '101.0000')).rejects.toThrow(/можно только снизить/);
  });
});

describe('Уценка заказа поставщика при выдаче дешевле цены приёмки (closeIssuance)', () => {
  function setup(opts: { arrivalPrice?: string; quantity: number; price: string; fact_cost?: string; order?: Parameters<typeof buildOrder>[0] }) {
    const order = buildOrder({ orderer_account: ORDERER, ...(opts.order ?? {}) });
    const saga = buildSaga({
      member_account: ORDERER,
      stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED,
      act1_document: signedDoc(ACT, [ORDERER]),
      fact: {
        actual_quantity: opts.quantity,
        actual_unit_price: opts.price,
        fact_cost: opts.fact_cost ?? (opts.quantity * Number.parseFloat(opts.price)).toFixed(4),
      },
    });
    const m = buildMocks({ order, sagas: [saga], warehouse: 10, arrivalPrice: opts.arrivalPrice });
    const service = buildService(m);
    stubSignatureChecks(service);
    return { m, service };
  }

  const close = (service: any) =>
    service.closeIssuance({ coopname: COOP, operator_account: 'chairkrg', order_id: 'order-1', signed_act: signedDoc(ACT, [ORDERER, 'chairkrg']) });

  it('выдано всё со сниженной ценой — разница уходит уценкой', async () => {
    // Принято 10 × 100 = 1000 ₽, выдано 10 × 90 = 900 ₽ → уценка 100 ₽.
    const { m, service } = setup({ arrivalPrice: '100.0000', quantity: 10, price: '90.0000' });
    await close(service);
    expect(m.chainPort.markdown).toHaveBeenCalledWith(expect.objectContaining({ coopname: COOP, order_hash: 'h-order-1', amount: '100.0000 RUB' }));
  });

  it('недовыдача со сниженной ценой — уценка только от выданного, остаток остаётся на складе по цене прибытия', async () => {
    // Выдано 8 × 90 = 720 ₽ при стоимости прибытия выданного 8 × 100 = 800 ₽.
    const { m, service } = setup({ arrivalPrice: '100.0000', quantity: 8, price: '90.0000' });
    await close(service);
    expect(m.chainPort.markdown).toHaveBeenCalledWith(expect.objectContaining({ amount: '80.0000 RUB' }));
  });

  it('недовыдача по цене прибытия — уценки нет', async () => {
    const { m, service } = setup({ arrivalPrice: '100.0000', quantity: 8, price: '100.0000' });
    await close(service);
    expect(m.chainPort.markdown).not.toHaveBeenCalled();
  });

  it('отпуск упаковкой: стоимость прибытия считается по упаковкам, а не по базовым единицам', async () => {
    // 10 упаковок по 0,5 л, прибытие 80 ₽ за упаковку = 800 ₽; выдано по 70 = 700 ₽.
    const { m, service } = setup({
      arrivalPrice: '80.0000',
      quantity: 5,
      price: '70.0000',
      fact_cost: '700.0000',
      order: { quantity: 5, package_size: 0.5, unit_of_measure: 'liter' as never, price_per_unit: '80.0000', total_cost: '800.0000' },
    });
    await close(service);
    expect(m.chainPort.markdown).toHaveBeenCalledWith(expect.objectContaining({ amount: '100.0000 RUB' }));
  });

  it('цены прибытия на складе нет — уценку не выдумываем', async () => {
    const { m, service } = setup({ quantity: 10, price: '90.0000' });
    await close(service);
    expect(m.chainPort.markdown).not.toHaveBeenCalled();
  });
});
