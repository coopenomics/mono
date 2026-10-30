import { registerEnumType } from '@nestjs/graphql';
import { DocumentApprovalRequirement, DocumentApprovalState, DocumentKind } from '@coopenomics/docs-templates';

/**
 * Перечисления фабрики утверждений — из `@coopenomics/docs-templates`, чтобы
 * контроллер и рабочий стол читали одни и те же значения. Здесь они только
 * регистрируются в схеме GraphQL.
 */
export { DocumentApprovalRequirement, DocumentApprovalState, DocumentKind };

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
