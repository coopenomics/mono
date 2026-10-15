import type { DocumentApprovalRequirement, DocumentApprovalState, DocumentKind } from '../enums/document-approval.enums';

/**
 * Строка реестра шаблонов кооператива: декларация приложения, сведённая с
 * редакцией в сети, утверждением совета и повесткой.
 */
export interface DocumentTemplateView {
  registry_id: number;
  extension_name: string;
  kind: DocumentKind;
  approval: DocumentApprovalRequirement;
  bundle: string | null;
  vars_field: string | null;
  title: string;
  order: number;
  /** Редакция шаблона в сети; `null`, если шаблона в цепи нет. */
  current_version: number | null;
  /** Утверждённая советом редакция; `null`, если утверждения нет. */
  approved_version: number | null;
  approved_decision_id: number | null;
  approved_at: string | null;
  /** Редакция, которую кооператив предъявляет пайщикам и пишет в подписи. */
  effective_version: number | null;
  state: DocumentApprovalState;
  /** Хэш проекта решения в повестке, если документ в состоянии `pending`. */
  pending_hash: string | null;
}
