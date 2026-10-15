/**
 * Выдача (паевая модель): заявление и акт вправе подписать только владелец
 * заказа. Проверка принадлежности стоит до всяких переходов саги и до цепи —
 * чужая подпись не создаёт ни заявления, ни акта.
 */
import { ForbiddenException } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import { MarketplaceIssuanceSagaStages } from '~/extensions/marketplace/domain/entities/marketplace-issuance-saga.types';
import { COOP, buildMocks, buildOrder, buildSaga, buildService, signedDoc, stubSignatureChecks } from './issuance-saga.fixture';

/** Владелец заказа: только его ключ вправе двигать выдачу. */
const OWNER = 'ekaterina';
/** Другой пайщик того же кооператива — посторонний этому заказу. */
const STRANGER = 'orderer2';

const ACT_ID = Cooperative.Registry.MarketplaceShareReturnAct.registry_id;
const STATEMENT_ID = Cooperative.Registry.MarketplaceShareReturnStatement.registry_id;

function setup(stage: 'statement' | 'act') {
  const order = buildOrder({ orderer_account: OWNER });
  const saga = buildSaga({
    member_account: OWNER,
    stage: stage === 'statement' ? MarketplaceIssuanceSagaStages.FACT_FIXED : MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED,
    act_document_hash: 'doc-hash',
    decision_id: '77',
  });
  const m = buildMocks({ order, sagas: [saga] });
  const service = buildService(m);
  stubSignatureChecks(service);
  return { m, service };
}

describe('Выдача: заявление подписывает только владелец заказа', () => {
  const meta = { registry_id: STATEMENT_ID, order_hash: 'h-order-1', total_amount: '1000.0000' };

  it('чужая подпись — отказ, заявление в цепь не уходит', async () => {
    const { m, service } = setup('statement');
    await expect(
      service.submitStatement({ coopname: COOP, member_account: STRANGER, order_id: 'order-1', signed_statement: signedDoc(meta, [STRANGER]) })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(m.chainPort.issueStmt).not.toHaveBeenCalled();
  });

  it('подпись владельца — заявление уходит в цепь', async () => {
    const { m, service } = setup('statement');
    await service.submitStatement({ coopname: COOP, member_account: OWNER, order_id: 'order-1', signed_statement: signedDoc(meta, [OWNER]) });
    expect(m.chainPort.issueStmt).toHaveBeenCalledWith(expect.objectContaining({ orderer: OWNER }));
  });
});

describe('Выдача: акт подписывает только владелец заказа', () => {
  const meta = { registry_id: ACT_ID, order_hash: 'h-order-1' };
  const sign = (service: any, member: string, signers: string[]) =>
    service.signAct1({ coopname: COOP, member_account: member, order_id: 'order-1', signed_act: signedDoc(meta, signers) });

  it('акт подписан другим пайщиком — отказ, на цепь ничего не уходит', async () => {
    const { m, service } = setup('act');
    await expect(sign(service, STRANGER, [STRANGER])).rejects.toBeInstanceOf(ForbiddenException);
    expect(m.chainPort.issueAct1).not.toHaveBeenCalled();
  });

  it('подписей нет вовсе — отказ', async () => {
    const { m, service } = setup('act');
    // Криптопроверка заглушена, но проверка «кто подписал» — нет: пустой список не проходит.
    jest.restoreAllMocks();
    await expect(sign(service, OWNER, [])).rejects.toBeInstanceOf(ForbiddenException);
    expect(m.chainPort.issueAct1).not.toHaveBeenCalled();
  });

  it('акт подписан владельцем — уходит в цепь', async () => {
    const { m, service } = setup('act');
    await sign(service, OWNER, [OWNER]);
    expect(m.chainPort.issueAct1).toHaveBeenCalledWith(expect.objectContaining({ orderer: OWNER, order_hash: 'h-order-1' }));
  });

  it('подпись владельца рядом с чужой принимается — акт может нести несколько подписей', async () => {
    const { m, service } = setup('act');
    await sign(service, OWNER, [STRANGER, OWNER]);
    expect(m.chainPort.issueAct1).toHaveBeenCalled();
  });
});
