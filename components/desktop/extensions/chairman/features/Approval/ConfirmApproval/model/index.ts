import { useApprovalStore } from 'app/extensions/chairman/entities/Approval/model';
import { useChairmanApprovalDecision } from 'src/features/ChairmanApproval';
import type { IConfirmApprovalOutput } from '../api';
import type { IDocumentAggregate } from 'src/entities/Document/model';

export function useConfirmApproval() {
  const store = useApprovalStore();
  const { approve } = useChairmanApprovalDecision();

  const confirmApproval = async (coopname: string, approvalHash: string, approved_document?: IDocumentAggregate): Promise<IConfirmApprovalOutput> => {
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
