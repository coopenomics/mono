import { signDocument } from 'src/shared/lib/document';
import { useSessionStore } from 'src/entities/Session/model';
import type { IDocumentAggregate, ISignedDocument2 } from 'src/entities/Document/model';
import {
  confirmApproval,
  declineApproval,
  findApprovalByHash,
  type IConfirmApprovalOutput,
  type IDeclineApprovalOutput,
} from '../api';

/**
 * Решение председателя по одобрению. Одобрить — подписать документ второй
 * подписью и отправить; отклонить — с причиной, её видит тот, кому отказали.
 */
export function useChairmanApprovalDecision() {
  const session = useSessionStore();

  /**
   * Подписать и одобрить. Документ можно передать, если он уже загружен
   * (стол председателя); иначе одобрение берётся по хэшу.
   */
  async function approve(coopname: string, approvalHash: string, document?: IDocumentAggregate): Promise<IConfirmApprovalOutput> {
    const aggregate = document ?? (await findApprovalByHash(coopname, approvalHash))?.document ?? undefined;
    let approved_document: ISignedDocument2 | undefined;
    if (aggregate?.rawDocument) {
      // Вторая подпись — председателя, поверх подписи пайщика.
      approved_document = await signDocument(aggregate.rawDocument, session.username, 2, [aggregate.document]);
    }
    return confirmApproval({ coopname, approval_hash: approvalHash.toLowerCase(), approved_document });
  }

  function decline(coopname: string, approvalHash: string, reason: string): Promise<IDeclineApprovalOutput> {
    return declineApproval({ coopname, approval_hash: approvalHash.toLowerCase(), reason });
  }

  return { approve, decline };
}
