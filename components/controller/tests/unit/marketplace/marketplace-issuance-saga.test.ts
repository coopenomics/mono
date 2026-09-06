/**
 * Сага выдачи имущества (паевая модель, компонент 68):
 * факт у стойки → заявление 1113 → решение совета (робот / люди) → акт 1115
 * → закрывающая подпись оператора. Проверяются гарды и переходы этапов; цепь,
 * документы и робот — моки.
 */
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import { MarketplaceIssuanceSagaStages } from '~/extensions/marketplace/domain/entities/marketplace-issuance-saga.types';
import {
  MARKETPLACE_ISSUANCE_DECIDED_OFFLINE_EVENT,
  MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
} from '~/extensions/marketplace/application/events/marketplace-notification.events';
import {
  COOP,
  buildMocks,
  buildOrder,
  buildSaga,
  buildService,
  signedDoc,
  stubSignatureChecks,
} from './issuance-saga.fixture';

const STATEMENT_ID = Cooperative.Registry.MarketplaceShareReturnStatement.registry_id;
const ACT_ID = Cooperative.Registry.MarketplaceShareReturnAct.registry_id;

describe('Готовность к выдаче (readyIssue)', () => {
  it('нельзя отметить готовность, пока на склад по заказу ничего не принято', async () => {
    const m = buildMocks({ order: buildOrder({ status: 'ACCEPTED_TO_COOP' }), warehouse: 0 });
    const service = buildService(m);
    await expect(service.readyIssue({ coopname: COOP, order_id: 'order-1', operator_account: 'chairkrg' })).rejects.toBeInstanceOf(ConflictException);
    expect(m.chainPort.readyIssue).not.toHaveBeenCalled();
  });

  it('идемпотентно: заказ уже готов к получению — цепь не трогаем', async () => {
    const m = buildMocks({ order: buildOrder({ status: 'READY_TO_RECEIVE' }) });
    const service = buildService(m);
    await service.readyIssue({ coopname: COOP, order_id: 'order-1', operator_account: 'chairkrg' });
    expect(m.chainPort.readyIssue).not.toHaveBeenCalled();
  });

  it('принят кооперативом и имущество на складе → readyissue в цепи и push заказчику', async () => {
    const m = buildMocks({ order: buildOrder({ status: 'ACCEPTED_TO_COOP' }), warehouse: 5 });
    const service = buildService(m);
    await service.readyIssue({ coopname: COOP, order_id: 'order-1', operator_account: 'chairkrg' });
    expect(m.chainPort.readyIssue).toHaveBeenCalledWith(expect.objectContaining({ signer: 'chairkrg', order_hash: 'h-order-1' }));
    expect(m.eventBus.emit).toHaveBeenCalledWith(MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT, expect.objectContaining({ order_id: 'order-1' }));
  });
});

describe('Факт у стойки (fixFact)', () => {
  const fix = (service: any, actual_quantity = 10, actual_unit_price = '100.0000') =>
    service.fixFact({ coopname: COOP, operator_account: 'chairkrg', order_id: 'order-1', actual_quantity, actual_unit_price });

  it('отклоняет выдачу неверифицированному получателю — проверяется получатель, не оператор', async () => {
    const m = buildMocks();
    m.verificationPort.checkRequired.mockResolvedValue({ passed: false, missing: ['passport_onsite'] });
    await expect(fix(buildService(m))).rejects.toThrow(/верификацию личности/);
    expect(m.verificationPort.checkRequired).toHaveBeenCalledWith('orderer1', 'marketplace.issue_property');
    expect(m.sagaRepo.createOrReuse).not.toHaveBeenCalled();
  });

  it('нельзя выдать больше, чем принято на склад (mkt.iss.side.03)', async () => {
    const m = buildMocks({ warehouse: 5 });
    await expect(fix(buildService(m), 10)).rejects.toThrow(/больше, чем принято/);
    expect(m.sagaRepo.createOrReuse).not.toHaveBeenCalled();
  });

  it('на складе пусто — выдача недоступна', async () => {
    const m = buildMocks({ warehouse: 0 });
    await expect(fix(buildService(m), 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('факт в пределах принятого → сага FACT_FIXED, заявление 1113 на фактическую сумму', async () => {
    const m = buildMocks({ warehouse: 10 });
    const { saga, statement } = await fix(buildService(m), 8, '90.0000');
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.FACT_FIXED);
    expect(saga.fact).toEqual({ actual_quantity: 8, actual_unit_price: '90.0000', fact_cost: '720.0000' });
    expect(statement.meta.registry_id).toBe(STATEMENT_ID);
    expect(statement.meta.total_amount).toBe('720.0000');
    expect(statement.meta.fact_quantity).toBe(8);
    // Исходник обязан сохраниться в сторе: из него совет строит протокол.
    expect(statement.meta.skip_save).toBe(false);
  });

  it('отпуск упаковкой: заявление в упаковках — 5 × «упак. 0,1 кг» по цене упаковки', async () => {
    const order = buildOrder({ unit_of_measure: 'kilogram', package_size: 0.1, quantity: 0.5, price_per_unit: '50.0000', total_cost: '250.0000' });
    const m = buildMocks({ order, warehouse: 0.5 });
    const { statement } = await fix(buildService(m), 0.5, '50.0000');
    expect(statement.meta.fact_quantity).toBe(5);
    expect(statement.meta.unit_of_measurement).toMatch(/упак/);
    expect(statement.meta.total_amount).toBe('250.0000');
  });

  it('повторная фиксация по живой саге дальше FACT_FIXED — отказ (mkt.iss.side.05)', async () => {
    const m = buildMocks({ sagas: [buildSaga({ stage: MarketplaceIssuanceSagaStages.DECISION_PENDING })] });
    await expect(fix(buildService(m))).rejects.toThrow(/уже начата/);
  });
});

describe('Заявление заказчика (submitStatement)', () => {
  const statementMeta = { registry_id: STATEMENT_ID, order_hash: 'h-order-1', total_amount: '1000.0000' };
  const submit = (service: any, signer = 'orderer1', meta = statementMeta) =>
    service.submitStatement({ coopname: COOP, member_account: signer, order_id: 'order-1', signed_statement: signedDoc(meta, [signer]) });

  it('чужой пайщик подписать заявление не может', async () => {
    const m = buildMocks({ sagas: [buildSaga()] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(submit(service, 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
    expect(m.chainPort.issueStmt).not.toHaveBeenCalled();
  });

  it('заявление подписано для другого заказа — отказ до цепи', async () => {
    const m = buildMocks({ sagas: [buildSaga()] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(submit(service, 'orderer1', { ...statementMeta, order_hash: 'h-other' })).rejects.toBeInstanceOf(BadRequestException);
    expect(m.chainPort.issueStmt).not.toHaveBeenCalled();
  });

  it('цепь недоступна — конфликт с причиной, сага остаётся в FACT_FIXED (mkt.iss.break.01)', async () => {
    const m = buildMocks({ sagas: [buildSaga()] });
    m.chainPort.issueStmt.mockRejectedValueOnce(new Error('nodeos unreachable'));
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(submit(service)).rejects.toThrow(/nodeos unreachable/);
    const saga = m.sagaStore.get('saga-1')!;
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.FACT_FIXED);
    expect(saga.last_error).toContain('nodeos unreachable');
  });

  it('без робота: заявление в цепи, номер решения дочитан, режим MANUAL — спокойное ожидание без блокировки', async () => {
    const m = buildMocks({ sagas: [buildSaga()] });
    const service = buildService(m);
    stubSignatureChecks(service);
    const saga = await submit(service);
    expect(m.chainPort.issueStmt).toHaveBeenCalledWith(expect.objectContaining({ orderer: 'orderer1', order_hash: 'h-order-1' }));
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.DECISION_PENDING);
    expect(saga.decision_id).toBe('77');
    expect(saga.decision_mode).toBe('MANUAL');
    expect(saga.awaits_council).toBe(true);
  });

  it('робот отвечает «manual» (нет кворума / крупная сумма) — режим MANUAL, у стойки не ждём', async () => {
    const robotPort = { isEnabled: jest.fn(async () => true), requestDecision: jest.fn(async () => ({ outcome: 'manual', detail: 'нет кворума' })) };
    const m = buildMocks({ sagas: [buildSaga()], robotPort });
    const service = buildService(m);
    stubSignatureChecks(service);
    const saga = await submit(service);
    expect(robotPort.requestDecision).toHaveBeenCalledWith(expect.objectContaining({ decision_id: 77, decision_type: 'mktissue', decision_hash: 'h-order-1', username: 'orderer1' }));
    expect(saga.decision_mode).toBe('MANUAL');
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.DECISION_PENDING);
  });

  it('робот решил у стойки: обратный вызов совета доводит сагу до акта в том же ответе', async () => {
    const m = buildMocks({ sagas: [buildSaga()] });
    const robotPort = {
      isEnabled: jest.fn(async () => true),
      requestDecision: jest.fn(async () => {
        // Решение приходит через парсер обратным вызовом контракта — чуть позже ответа робота.
        setTimeout(() => void service.onCouncilAuthorized({ coopname: COOP, order_hash: 'h-order-1', protocol: signedDoc({ decision_id: 77 }, ['voskhod']) }), 20);
        return { outcome: 'authorized' };
      }),
    };
    m.robotPort = robotPort;
    const service = buildService(m);
    stubSignatureChecks(service);
    const saga = await submit(service);
    expect(saga.decision_mode).toBe('ROBOT');
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED);
    expect(saga.awaits_member_signature).toBe(true);
    // Акт сформирован из факта и номера решения.
    expect(m.documentPort.generate).toHaveBeenCalledWith({ data: expect.objectContaining({ registry_id: ACT_ID, decision_id: 77, order_hash: 'h-order-1' }) });
    // Пайщик у стойки — push «подпишите акт» не нужен.
    expect(m.eventBus.emit).not.toHaveBeenCalledWith(MARKETPLACE_ISSUANCE_DECIDED_OFFLINE_EVENT, expect.anything());
  });
});

describe('Решение совета (onCouncilAuthorized / onCouncilDeclined)', () => {
  it('решение людей пришло позже: акт сформирован, пайщику уходит push «подпишите акт»', async () => {
    const m = buildMocks({ sagas: [buildSaga({ stage: MarketplaceIssuanceSagaStages.DECISION_PENDING, decision_mode: 'MANUAL', decision_id: '77' })] });
    const service = buildService(m);
    await service.onCouncilAuthorized({ coopname: COOP, order_hash: 'h-order-1', protocol: signedDoc({ decision_id: 77 }, ['voskhod']) });
    const saga = m.sagaStore.get('saga-1')!;
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED);
    expect(saga.act_document_hash).toBe(`hash-${ACT_ID}`);
    expect(m.orderRepo.applyIssuanceAuthorized).toHaveBeenCalledWith('order-1', { issue_decision_id: '77' });
    expect(m.eventBus.emit).toHaveBeenCalledWith(MARKETPLACE_ISSUANCE_DECIDED_OFFLINE_EVENT, expect.objectContaining({ order_id: 'order-1', authorized: true }));
  });

  it('повторный обратный вызов по решённой саге пропускается', async () => {
    const m = buildMocks({ sagas: [buildSaga({ stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED })] });
    const service = buildService(m);
    await service.onCouncilAuthorized({ coopname: COOP, order_hash: 'h-order-1', protocol: null });
    expect(m.documentPort.generate).not.toHaveBeenCalled();
    expect(m.sagaStore.get('saga-1')!.stage).toBe(MarketplaceIssuanceSagaStages.ACT1_SIGNED);
  });

  it('совет отказал: сага DECLINED, заказ снова готов к выдаче, паевой взнос на месте', async () => {
    const m = buildMocks({ sagas: [buildSaga({ stage: MarketplaceIssuanceSagaStages.DECISION_PENDING, decision_mode: 'MANUAL' })] });
    const service = buildService(m);
    await service.onCouncilDeclined({ coopname: COOP, order_hash: 'h-order-1', reason: 'нет кворума' });
    expect(m.sagaStore.get('saga-1')!.stage).toBe(MarketplaceIssuanceSagaStages.DECLINED);
    expect(m.orderRepo.applyIssuanceReset).toHaveBeenCalledWith('order-1');
    expect(m.eventBus.emit).toHaveBeenCalledWith(MARKETPLACE_ISSUANCE_DECIDED_OFFLINE_EVENT, expect.objectContaining({ authorized: false }));
  });
});

describe('Акт заказчика (signAct1)', () => {
  const actMeta = { registry_id: ACT_ID, order_hash: 'h-order-1' };
  const authorized = () => buildSaga({ stage: MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED, decision_id: '77', act_document_hash: 'doc-hash' });
  const sign = (service: any, signer: string, doc = signedDoc(actMeta, [signer])) =>
    service.signAct1({ coopname: COOP, member_account: signer, order_id: 'order-1', signed_act: doc });

  it('акт по чужому заказу — отказ доступа, на цепь ничего не уходит (mkt.iss.side.06)', async () => {
    const m = buildMocks({ sagas: [authorized()] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(sign(service, 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
    expect(m.chainPort.issueAct1).not.toHaveBeenCalled();
  });

  it('совет ещё не решил — акт подписывать нельзя', async () => {
    const m = buildMocks({ sagas: [buildSaga({ stage: MarketplaceIssuanceSagaStages.DECISION_PENDING })] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(sign(service, 'orderer1')).rejects.toThrow(/не принял решение/);
  });

  it('подписан не тот акт, что выдан к подписи — отказ', async () => {
    const m = buildMocks({ sagas: [authorized()] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(sign(service, 'orderer1', signedDoc(actMeta, ['orderer1'], { doc_hash: 'other' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('владелец подписал → issueact1 в цепи, сага ACT1_SIGNED, ход за оператором', async () => {
    const m = buildMocks({ sagas: [authorized()] });
    const service = buildService(m);
    stubSignatureChecks(service);
    const saga = await sign(service, 'orderer1');
    expect(m.chainPort.issueAct1).toHaveBeenCalledWith(expect.objectContaining({ orderer: 'orderer1', order_hash: 'h-order-1' }));
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.ACT1_SIGNED);
    expect(saga.awaits_operator_close).toBe(true);
  });
});

describe('Закрывающая подпись оператора (closeIssuance)', () => {
  const actMeta = { registry_id: ACT_ID, order_hash: 'h-order-1' };
  const memberAct = signedDoc(actMeta, ['orderer1']);
  const act1Signed = () => buildSaga({ stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED, act1_document: memberAct, fact: { actual_quantity: 8, actual_unit_price: '100.0000', fact_cost: '800.0000' } });
  const bothSigned = () => signedDoc(actMeta, ['orderer1', 'chairkrg']);
  const close = (service: any, doc = bothSigned(), operator = 'chairkrg') =>
    service.closeIssuance({ coopname: COOP, operator_account: operator, order_id: 'order-1', signed_act: doc });

  it('подпись заказчика на акте утеряна — закрытие отклоняется', async () => {
    const m = buildMocks({ sagas: [act1Signed()] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(close(service, signedDoc(actMeta, ['chairkrg']))).rejects.toBeInstanceOf(ForbiddenException);
    expect(m.chainPort.issueAct2).not.toHaveBeenCalled();
  });

  it('закрывающей подписи оператора нет — отказ', async () => {
    const m = buildMocks({ sagas: [act1Signed()] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(close(service, signedDoc(actMeta, ['orderer1']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('цепь отказала — конфликт, имущество не передавать, сага не закрыта', async () => {
    const m = buildMocks({ sagas: [act1Signed()] });
    m.chainPort.issueAct2.mockRejectedValueOnce(new Error('insufficient funds'));
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(close(service)).rejects.toThrow(/не передавайте/);
    expect(m.sagaStore.get('saga-1')!.stage).toBe(MarketplaceIssuanceSagaStages.ACT1_SIGNED);
    expect(m.orderRepo.applyIssuanceClosed).not.toHaveBeenCalled();
  });

  it('оба подписали → issueact2, снапшот факта на заказе, сага CLOSED, остаток отделён по ВЫДАННОМУ количеству', async () => {
    const m = buildMocks({ sagas: [act1Signed()], warehouse: 9 });
    const service = buildService(m);
    stubSignatureChecks(service);
    const saga = await close(service);
    expect(m.chainPort.issueAct2).toHaveBeenCalledWith(expect.objectContaining({ delivery_signer: 'chairkrg', order_hash: 'h-order-1' }));
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.CLOSED);
    expect(m.orderRepo.applyIssuanceClosed).toHaveBeenCalledWith('order-1', expect.objectContaining({
      delivery_signer_account: 'chairkrg',
      issuance_fact: expect.objectContaining({ actual_quantity: 8, fact_cost: '800.0000', diff_state: 'less' }),
    }));
    expect(m.inventoryRepo.detachRemainderToStock).toHaveBeenCalledWith(COOP, 'order-1', 8, expect.any(String));
  });

  it('повторное закрытие уже закрытой саги — no-op', async () => {
    const m = buildMocks({ sagas: [buildSaga({ stage: MarketplaceIssuanceSagaStages.CLOSED, act1_document: memberAct })] });
    m.sagaRepo.findActiveByOrderId.mockResolvedValue(m.sagaStore.get('saga-1')!);
    const service = buildService(m);
    stubSignatureChecks(service);
    await close(service);
    expect(m.chainPort.issueAct2).not.toHaveBeenCalled();
  });
});

describe('Снятие выдачи (cancelIssuance)', () => {
  const cancel = (service: any) => service.cancelIssuance({ coopname: COOP, order_id: 'order-1', operator_account: 'chairkrg' });

  it('пока совет рассматривает заявление — снять нельзя', async () => {
    const m = buildMocks({ sagas: [buildSaga({ stage: MarketplaceIssuanceSagaStages.DECISION_PENDING })] });
    await expect(cancel(buildService(m))).rejects.toThrow(/Совет ещё рассматривает/);
  });

  it('до заявления цепь не задействована — снимается только сага', async () => {
    const m = buildMocks({ sagas: [buildSaga()] });
    const saga = await cancel(buildService(m));
    expect(m.chainPort.cancelIssue).not.toHaveBeenCalled();
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.CANCELLED);
  });

  it('после решения совета — cancelissue в цепи, заказ снова готов к выдаче', async () => {
    const m = buildMocks({ order: buildOrder({ status: 'ISSUE_AUTHORIZED' }), sagas: [buildSaga({ stage: MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED })] });
    const saga = await cancel(buildService(m));
    expect(m.chainPort.cancelIssue).toHaveBeenCalledWith(expect.objectContaining({ signer: 'chairkrg', order_hash: 'h-order-1' }));
    expect(saga.stage).toBe(MarketplaceIssuanceSagaStages.CANCELLED);
    expect(m.orderRepo.applyIssuanceReset).toHaveBeenCalledWith('order-1');
  });
});
