/**
 * Гарантийный возврат — заявление оператора участка в совет об отмене сделки
 * (1116), задача 99D-12.
 *
 * Пайщик подписывает только рекламацию (1106). У стойки оператор принимает
 * имущество под свою материальную ответственность и подписывает СВОЁ заявление
 * в совет: заказ и принятое имущество из рекламации, результат осмотра, суммы
 * паевого и членского взносов к восстановлению. Бэкенд собирает документ сам,
 * а при приёме сверяет, что подписан именно он — иначе в повестку совета уйдёт
 * не та сделка или не та сумма.
 */
import { MarketplaceReturnClaimService } from '~/extensions/marketplace/application/services/marketplace-return-claim.service';

const COOP = 'voskhod';
const ORDER_HASH = 'a'.repeat(64);
const REQUEST_HASH = 'b'.repeat(64);

function claimApproved(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1',
    coopname: COOP,
    request_hash: REQUEST_HASH,
    order_id: 'order-1',
    order_hash: ORDER_HASH,
    orderer_account: 'ekaterina',
    delivery_braname: 'krg',
    supplier_account: 'ivanpetrov',
    status: 'APPROVED_FOR_VISIT',
    reason_text: 'Молоко скисло до срока годности.',
    actual_quantity: 4,
    fact_cost: '400.0000',
    fee_refund: '40.0000',
    photos: [],
    statement: null,
    ...overrides,
  };
}

function receivedOrder() {
  return {
    id: 'order-1',
    coopname: COOP,
    orderer_account: 'ekaterina',
    status: 'RECEIVED',
    quantity: 10,
    issuance_fact: { actual_quantity: 10, fact_cost: '1000.0000' },
    unit_of_measure: 'kg',
    total_cost: '1000.0000',
    price_per_unit: '100.0000',
    order_hash: ORDER_HASH,
    offer_id: 'offer-1',
    delivery_braname: 'krg',
    issue_decision_id: '17',
  };
}

function makeService() {
  const claimRepo = { findById: jest.fn(), transition: jest.fn(), patchCouncil: jest.fn() };
  const orderRepo = { findById: jest.fn() };
  const offerRepo = { findById: jest.fn().mockResolvedValue({ product_name: 'Молоко «Бурёнка»' }) };
  const chainPort = { accRetrn: jest.fn() };
  const documentPort = { generate: jest.fn(async (input: { data: unknown }) => ({ meta: input.data, html: '', hash: 'h', full_title: 't', binary: '' })) };
  const service = new MarketplaceReturnClaimService(
    claimRepo as never,
    orderRepo as never,
    offerRepo as never,
    { create: jest.fn() } as never,
    chainPort as never,
    { symbol: 'RUB', decimals: 4 } as never,
    documentPort as never,
    { putImage: jest.fn() } as never,
    { emit: jest.fn() } as never,
    { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() } as never
  );
  return { service, claimRepo, orderRepo, chainPort, documentPort };
}

describe('Заявление оператора об отмене сделки: сборка документа', () => {
  it('собирается по рекламации и заказу: подписант — оператор, пайщик — из рекламации, суммы — из заявки', async () => {
    const { service, claimRepo, orderRepo, documentPort } = makeService();
    claimRepo.findById.mockResolvedValue(claimApproved());
    orderRepo.findById.mockResolvedValue(receivedOrder());

    await service.getChairmanReturnSignablePayload({
      coopname: COOP,
      claim_id: 'claim-1',
      operator_account: 'chairkrg',
      inspection_result: 'Упаковка вздута, продукт скис.',
    });

    const { data } = documentPort.generate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.registry_id).toBe(1116);
    expect(data.username).toBe('chairkrg');
    expect(data.operator).toBe('chairkrg');
    expect(data.orderer).toBe('ekaterina');
    expect(data.order_hash).toBe(ORDER_HASH);
    expect(data.request_hash).toBe(REQUEST_HASH);
    // Суммы — те, что контракт зафиксировал при подаче рекламации; всего = паевой + членский.
    expect(data.fact_cost).toBe('400.0000');
    expect(data.fee_refund).toBe('40.0000');
    expect(data.total_refund).toBe('440.0000');
    // Конкретная сделка — по номеру протокола совета о выдаче.
    expect(data.issue_decision_id).toBe(17);
    expect(data.inspection_result).toBe('Упаковка вздута, продукт скис.');
    expect(data.reason_text).toBe('Молоко скисло до срока годности.');
  });

  it('до одобрения очного визита заявление не готовится', async () => {
    const { service, claimRepo } = makeService();
    claimRepo.findById.mockResolvedValue(claimApproved({ status: 'PENDING_CHAIRMAN_REVIEW' }));

    await expect(
      service.getChairmanReturnSignablePayload({
        coopname: COOP,
        claim_id: 'claim-1',
        operator_account: 'chairkrg',
        inspection_result: 'Осмотрено.',
      })
    ).rejects.toThrow('только после одобрения очного визита');
  });

  it('без результата осмотра заявление не готовится: он входит в текст документа', async () => {
    const { service, claimRepo } = makeService();
    claimRepo.findById.mockResolvedValue(claimApproved());

    await expect(
      service.getChairmanReturnSignablePayload({
        coopname: COOP,
        claim_id: 'claim-1',
        operator_account: 'chairkrg',
        inspection_result: '   ',
      })
    ).rejects.toThrow();
    expect(claimRepo.findById).not.toHaveBeenCalled();
  });
});

function signedCancel(meta: Record<string, unknown>) {
  return {
    version: '1',
    hash: 'h',
    doc_hash: 'd',
    meta_hash: 'm',
    meta: {
      registry_id: 1116,
      order_hash: ORDER_HASH,
      request_hash: REQUEST_HASH,
      operator: 'chairkrg',
      inspection_result: 'Упаковка вздута, продукт скис.',
      ...meta,
    },
    signatures: [],
  };
}

function acceptInput(signed_statement: unknown) {
  return {
    coopname: COOP,
    chairman_account: 'chairkrg',
    braname: 'krg',
    claim_id: 'claim-1',
    inspection_result: 'Упаковка вздута, продукт скис.',
    scanned_barcode: null,
    signed_statement,
  } as never;
}

describe('Приём имущества у стойки: контроль подписанного заявления', () => {
  it('без заявления оператора приём невозможен — цепь не вызывается', async () => {
    const { service, claimRepo, chainPort } = makeService();
    claimRepo.findById.mockResolvedValue(claimApproved());

    await expect(service.acceptReturnAtVisit(acceptInput(undefined))).rejects.toThrow(
      'подписанное оператором заявление в совет об отмене сделки'
    );
    expect(chainPort.accRetrn).not.toHaveBeenCalled();
  });

  it('рекламация пайщика (1106) вместо заявления оператора отклоняется', async () => {
    const { service, claimRepo, chainPort } = makeService();
    claimRepo.findById.mockResolvedValue(claimApproved());

    await expect(
      service.acceptReturnAtVisit(acceptInput(signedCancel({ registry_id: 1106 })))
    ).rejects.toThrow('Подписан не тот документ');
    expect(chainPort.accRetrn).not.toHaveBeenCalled();
  });

  it('заявление на другую рекламацию или другой заказ отклоняется', async () => {
    const { service, claimRepo, chainPort } = makeService();
    claimRepo.findById.mockResolvedValue(claimApproved());

    await expect(
      service.acceptReturnAtVisit(acceptInput(signedCancel({ request_hash: 'c'.repeat(64) })))
    ).rejects.toThrow('Подписан не тот документ');
    await expect(
      service.acceptReturnAtVisit(acceptInput(signedCancel({ order_hash: 'c'.repeat(64) })))
    ).rejects.toThrow('Подписан не тот документ');
    expect(chainPort.accRetrn).not.toHaveBeenCalled();
  });

  it('заявление, составленное на другого оператора, отклоняется', async () => {
    const { service, claimRepo, chainPort } = makeService();
    claimRepo.findById.mockResolvedValue(claimApproved());

    await expect(
      service.acceptReturnAtVisit(acceptInput(signedCancel({ operator: 'someoneelse' })))
    ).rejects.toThrow('подписывает тот оператор, на чьё имя оно составлено');
    expect(chainPort.accRetrn).not.toHaveBeenCalled();
  });

  it('результат осмотра в заявлении обязан совпадать с введённым у стойки', async () => {
    const { service, claimRepo, chainPort } = makeService();
    claimRepo.findById.mockResolvedValue(claimApproved());

    await expect(
      service.acceptReturnAtVisit(acceptInput(signedCancel({ inspection_result: 'Другой текст.' })))
    ).rejects.toThrow('подпишите заявление заново');
    expect(chainPort.accRetrn).not.toHaveBeenCalled();
  });
});
