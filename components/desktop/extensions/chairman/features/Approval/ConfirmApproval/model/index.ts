import { useApprovalStore } from 'app/extensions/chairman/entities/Approval/model';
import { api } from '../api';
import type { IConfirmApprovalOutput } from '../api';
import { signDocument } from 'src/shared/lib/document';
import { useSessionStore } from 'src/entities/Session/model';
import type { IDocumentAggregate, ISignedDocument2 } from 'src/entities/Document/model';

export function useConfirmApproval() {
  const store = useApprovalStore();
  const { username } = useSessionStore();

  const confirmApproval = async ( coopname: string, approvalHash: string, approved_document?: IDocumentAggregate ): Promise<IConfirmApprovalOutput> => {
    let approvedDocumentToSend: ISignedDocument2 | undefined;

    if (approved_document?.rawDocument) {
      // Подписываем документ второй подписью
      approvedDocumentToSend = await signDocument(
        approved_document.rawDocument,
        username,
        2, // signatureId = 2 для второй подписи
        [approved_document.document],
      );
    }

    const result = await api.confirmApproval({
      coopname,
      approval_hash: approvalHash.toLowerCase(),
      approved_document: approvedDocumentToSend,
    });

    if (result) {
      // Обновляем approval в списке (меняем статус на approved)
      store.updateApprovalInList(result);
    }

    return result;
  };

  return { confirmApproval };
}
