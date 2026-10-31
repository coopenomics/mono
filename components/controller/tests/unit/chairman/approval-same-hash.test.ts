/**
 * Два одобрения подряд под одним approval_hash: взнос имуществом в «Благорост»
 * ставит председателю заявление, а после решения совета — акт, оба под хэшем
 * взноса. Совет стирает первое при подтверждении, второе приходит новой
 * строкой цепи. Стол председателя обязан показать его ожидающим.
 */
import { ApprovalDomainEntity } from '~/extensions/chairman/domain/entities/approval.entity';
import { ApprovalStatus } from '~/extensions/chairman/domain/enums/approval-status.enum';

const HASH = 'ab'.repeat(32);

const chainRow = (id: number, action: string) =>
  ({
    id,
    coopname: 'voskhod',
    username: 'ivan',
    document: { doc_hash: `doc-${id}` },
    approval_hash: HASH,
    callback_contract: 'capital',
    callback_action_approve: action,
    callback_action_decline: 'declinepgprp',
    meta: '',
    created_at: '2026-10-31T07:19:00',
  }) as any;

function approvedStatementApproval(): ApprovalDomainEntity {
  const entity = new ApprovalDomainEntity(
    { _id: 'x', block_num: 10, present: true, status: ApprovalStatus.PENDING, approval_hash: HASH } as any,
    chainRow(2, 'approvepgprp')
  );
  entity.approve({ doc_hash: 'signed-statement' } as any);
  return entity;
}

describe('Одобрение председателя: второй запрос под тем же хэшем', () => {
  it('новая строка цепи с другим id — запрос ожидает подписи, подпись прежнего стёрта', () => {
    const entity = approvedStatementApproval();
    entity.updateFromBlockchain(chainRow(3, 'act2pgprp'), 20, true);

    expect(entity.id).toBe(3);
    expect(entity.callback_action_approve).toBe('act2pgprp');
    expect(entity.status).toBe(ApprovalStatus.PENDING);
    expect(entity.approved_document).toBeNull();
  });

  it('та же строка цепи (тот же id) — статус и подпись остаются', () => {
    const entity = approvedStatementApproval();
    entity.updateFromBlockchain(chainRow(2, 'approvepgprp'), 20, true);

    expect(entity.status).toBe(ApprovalStatus.APPROVED);
    expect(entity.approved_document).toEqual({ doc_hash: 'signed-statement' });
  });

  it('удаление строки после подтверждения статус не сбрасывает', () => {
    const entity = approvedStatementApproval();
    entity.updateFromBlockchain(chainRow(2, 'approvepgprp'), 21, false);

    expect(entity.status).toBe(ApprovalStatus.APPROVED);
  });
});
