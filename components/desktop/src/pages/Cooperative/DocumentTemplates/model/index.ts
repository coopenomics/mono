import { Zeus, type Mutations, type Queries } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { t as i18nT } from 'src/shared/i18n';

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
  [DocumentApprovalState.NotRequired]: { label: i18nT('cooperative.documentTemplatesModel.stateNotRequired'), variant: 'neutral' },
  [DocumentApprovalState.NotApproved]: { label: i18nT('cooperative.documentTemplatesModel.stateNotApproved'), variant: 'warn' },
  [DocumentApprovalState.Pending]: { label: i18nT('cooperative.documentTemplatesModel.statePending'), variant: 'info' },
  [DocumentApprovalState.Approved]: { label: i18nT('cooperative.documentTemplatesModel.stateApproved'), variant: 'pos' },
  [DocumentApprovalState.Outdated]: { label: i18nT('cooperative.documentTemplatesModel.stateOutdated'), variant: 'warn' },
};

export const KIND_LABEL: Record<string, string> = {
  [DocumentKind.Agreement]: i18nT('cooperative.documentTemplatesModel.kindAgreement'),
  [DocumentKind.Provision]: i18nT('cooperative.documentTemplatesModel.kindProvision'),
  [DocumentKind.Form]: i18nT('cooperative.documentTemplatesModel.kindForm'),
  [DocumentKind.Service]: i18nT('cooperative.documentTemplatesModel.kindService'),
};

/** Человеческие названия владельцев документов; неизвестное приложение показывается своим имением. */
export const OWNER_LABEL: Record<string, string> = {
  core: i18nT('cooperative.documentTemplatesModel.ownerCore'),
  capital: i18nT('cooperative.documentTemplatesModel.ownerCapital'),
  market: i18nT('cooperative.documentTemplatesModel.ownerMarket'),
  chairman: i18nT('cooperative.documentTemplatesModel.ownerChairman'),
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

export { DOCUMENT_TEMPLATES_LIVE_TABLES } from './live';
