import { Zeus, type Mutations, type Queries } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';

export type IDocumentTemplate =
  Queries.DocumentApprovals.DocumentTemplates.IOutput[typeof Queries.DocumentApprovals.DocumentTemplates.name][number];
export type IDocumentTemplateBlank =
  Queries.DocumentApprovals.DocumentTemplateBlank.IOutput[typeof Queries.DocumentApprovals.DocumentTemplateBlank.name];
export type IDocumentTemplateBlankInput = Queries.DocumentApprovals.DocumentTemplateBlank.IInput;
export type IProposeDocumentApprovalInput = Mutations.DocumentApprovals.ProposeDocumentApproval.IInput['data'];
export type IDocumentTemplateEdition = Zeus.ModelTypes['DocumentTemplateEdition'];

// Значения приходят из схемы GraphQL именами перечислений (`NotRequired`,
// `Outdated`), а не внутренними значениями cooptypes — сравнивать нужно с Zeus.
export const DocumentApprovalState = Zeus.DocumentApprovalState;
export const DocumentKind = Zeus.DocumentKind;
export const DocumentApprovalRequirement = Zeus.DocumentApprovalRequirement;
export const DocumentTemplateEdition = Zeus.DocumentTemplateEdition;

/** Подпись и цвет состояния документа в кооперативе. */
export const STATE_VIEW: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  [DocumentApprovalState.NotRequired]: { label: 'Не требуется', variant: 'neutral' },
  [DocumentApprovalState.NotApproved]: { label: 'Не утверждён', variant: 'warn' },
  [DocumentApprovalState.Pending]: { label: 'В повестке', variant: 'info' },
  [DocumentApprovalState.Approved]: { label: 'Утверждён', variant: 'pos' },
  [DocumentApprovalState.Outdated]: { label: 'Новая редакция', variant: 'warn' },
};

export const KIND_LABEL: Record<string, string> = {
  [DocumentKind.Agreement]: 'Соглашение',
  [DocumentKind.Provision]: 'Положение',
  [DocumentKind.Form]: 'Форма',
  [DocumentKind.Service]: 'Служебный',
};

/** Человеческие названия владельцев документов; неизвестное приложение показывается своим имением. */
export const OWNER_LABEL: Record<string, string> = {
  core: 'Кооператив',
  capital: 'Капитал',
  market: 'Стол заказов',
  chairman: 'Совет',
};

export const ownerLabel = (extension_name: string): string => OWNER_LABEL[extension_name] ?? extension_name;

/** Документ ждёт решения совета: без утверждённой редакции или с устаревшей. */
export const needsCouncil = (t: IDocumentTemplate): boolean =>
  t.approval === DocumentApprovalRequirement.Required &&
  (t.state === DocumentApprovalState.NotApproved || t.state === DocumentApprovalState.Outdated);

/**
 * Что уйдёт на совет вместе с документом: весь его пакет в том же приложении,
 * пока документы пакета сами ждут решения. Одиночный документ — только он.
 */
export const bundleToPropose = (all: IDocumentTemplate[], target: IDocumentTemplate): IDocumentTemplate[] => {
  if (!target.bundle) return [target];
  return all.filter((t) => t.extension_name === target.extension_name && t.bundle === target.bundle && needsCouncil(t));
};
