import { DocumentApprovalRequirement, DocumentApprovalState } from '../enums/document-approval.enums';

export interface DocumentStateInput {
  approval: DocumentApprovalRequirement;
  /** Редакция шаблона в сети; `null`, если шаблона в цепи нет. */
  current_version: number | null;
  /** Утверждённая кооперативом редакция; `null`, если совет не утверждал. */
  approved_version: number | null;
  /** Есть активное правило отслеживания: проект решения в повестке. */
  pending: boolean;
}

/**
 * Состояние документа в кооперативе. Чистая функция: все входы читаются
 * заранее, здесь только правило.
 *
 * `pending` побеждает «устарело» и «не утверждено»: пока проект решения в
 * повестке, повторно выносить документ нельзя. Утверждённая редакция выше
 * текущей невозможна (контракт не даёт утвердить несуществующую), но если
 * сеть откатилась, считаем документ утверждённым, а не устаревшим.
 */
export function computeDocumentState(input: DocumentStateInput): DocumentApprovalState {
  if (input.approval === DocumentApprovalRequirement.None) return DocumentApprovalState.NotRequired;
  if (input.pending) return DocumentApprovalState.Pending;
  if (input.approved_version === null) return DocumentApprovalState.NotApproved;
  if (input.current_version !== null && input.approved_version < input.current_version) {
    return DocumentApprovalState.Outdated;
  }
  return DocumentApprovalState.Approved;
}
