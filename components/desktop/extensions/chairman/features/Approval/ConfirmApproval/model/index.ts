import { useApprovalStore } from 'app/extensions/chairman/entities/Approval/model';
import { useChairmanApprovalDecision } from 'src/features/ChairmanApproval';
import type { IConfirmApprovalOutput } from '../api';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { runApprovalPreSign } from 'src/shared/lib/approval-hooks';

export function useConfirmApproval() {
  const store = useApprovalStore();
  const { approve } = useChairmanApprovalDecision();

  const confirmApproval = async (
    coopname: string,
    approvalHash: string,
    approved_document?: IDocumentAggregate,
    actionKey?: string,
  ): Promise<IConfirmApprovalOutput> => {
    // Документы, которые председатель подписывает вместе с основным (у займа — договор залога и акт).
    await runApprovalPreSign(actionKey, { coopname, approvalHash });
    // Подпись второй подписью и отправка — общим слоем, как на любом столе.
    const result = await approve(coopname, approvalHash, approved_document);
    if (result) {
      // Обновляем approval в списке (меняем статус на approved)
      store.updateApprovalInList(result);
    }
    return result;
  };

  return { confirmApproval };
}
