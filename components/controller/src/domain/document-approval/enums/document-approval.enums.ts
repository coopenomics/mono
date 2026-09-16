import { registerEnumType } from '@nestjs/graphql';
import { Cooperative } from 'cooptypes';

/**
 * Перечисления фабрики утверждений — из `cooptypes`, чтобы контроллер и
 * рабочий стол читали одни и те же значения. Здесь они только регистрируются
 * в схеме GraphQL.
 */
export const DocumentKind = Cooperative.Document.DocumentKind;
export type DocumentKind = Cooperative.Document.DocumentKind;

export const DocumentApprovalRequirement = Cooperative.Document.DocumentApprovalRequirement;
export type DocumentApprovalRequirement = Cooperative.Document.DocumentApprovalRequirement;

export const DocumentApprovalState = Cooperative.Document.DocumentApprovalState;
export type DocumentApprovalState = Cooperative.Document.DocumentApprovalState;

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
