import { registerEnumType } from '@nestjs/graphql';
import { DocumentApprovalRequirement as DocsDocumentApprovalRequirement, DocumentApprovalState as DocsDocumentApprovalState, DocumentKind as DocsDocumentKind } from '@coopenomics/docs-templates';

/**
 * Перечисления фабрики утверждений — из `cooptypes`, чтобы контроллер и
 * рабочий стол читали одни и те же значения. Здесь они только регистрируются
 * в схеме GraphQL.
 */
export const DocumentKind: typeof DocsDocumentKind = DocsDocumentKind;
export type DocumentKind = DocsDocumentKind;

export const DocumentApprovalRequirement: typeof DocsDocumentApprovalRequirement =
  DocsDocumentApprovalRequirement;
export type DocumentApprovalRequirement = DocsDocumentApprovalRequirement;

export const DocumentApprovalState: typeof DocsDocumentApprovalState = DocsDocumentApprovalState;
export type DocumentApprovalState = DocsDocumentApprovalState;

registerEnumType(DocumentKind, {
  name: 'DocumentKind',
  description: 'Род документа: соглашение пайщика, положение, форма или служебный документ',
});

registerEnumType(DocumentApprovalRequirement, {
  name: 'DocumentApprovalRequirement',
  description: 'Требуется ли решение совета, чтобы редакция документа действовала в кооперативе',
});

registerEnumType(DocumentApprovalState, {
  name: 'DocumentApprovalState',
  description: 'Состояние документа в кооперативе относительно редакции в сети',
});
