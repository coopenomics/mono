import { registerApprovalPreSign } from 'src/shared/lib/approval-hooks';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument, signDocument } from 'src/shared/lib/document';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import type { Cooperative } from 'cooptypes';
import { chairmanSignLoan, generateLoanPledgeAct, getLoan } from '../api';
import { t } from '../i18n';

/**
 * Подпись договора займа председателем идёт запросом одобрения. Вместе с ним
 * председатель подписывает договор залога (вторая подпись под документом
 * пайщика) и акт передачи права в залог (первая подпись; вторую ставит
 * пайщик). Оба уходят в цепь до подтверждения одобрения: без них контракт
 * подпись договора не примет.
 */
export function registerDebtApprovalHooks(): void {
  registerApprovalPreSign('debt::loansigned', async ({ coopname, approvalHash }) => {
    const session = useSessionStore();
    // Хэш запроса одобрения у займа равен хэшу займа.
    const loan = await getLoan(approvalHash.toLowerCase());
    const pledge = loan.pledge_contract as IDocumentAggregate | null | undefined;
    if (!pledge?.rawDocument || !pledge.document) throw new Error(t('debt.chairman.pledgeMissingError'));
    const decisionId = Number((loan.decision as IDocumentAggregate | null | undefined)?.document?.meta?.decision_id);
    if (!decisionId) throw new Error(t('debt.chairman.decisionMissingError'));

    const signed_pledge_contract = await signDocument(pledge.rawDocument, session.username, 2, [pledge.document]);
    const actDoc = await generateLoanPledgeAct({
      coopname,
      username: loan.username as string,
      debt_hash: loan.debt_hash,
      amount: loan.amount as string,
      due_at: loan.due_at as string,
      collateral: loan.collateral as string,
      decision_id: decisionId,
    });
    const act = await new DigitalDocument(actDoc).sign<Cooperative.Registry.LoanPledgeAct.Meta>(session.username, 1);
    await chairmanSignLoan({ coopname, debt_hash: loan.debt_hash, signed_pledge_contract, act });
  });
}
