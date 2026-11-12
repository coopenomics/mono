import { t } from '../../i18n';
const approval_action_labels: Record<string, string> = {
  'capital::apprvappndx': t('chairman.approvalActionLabels.blagorostProjectAccess'),
  'capital::approvereg': t('chairman.approvalActionLabels.blagorostUhdContract'),
  'capital::approveinvst': t('chairman.approvalActionLabels.blagorostInvestmentApplication'),
  'capital::approverslt': t('chairman.approvalActionLabels.blagorostRidContribution'),
  'capital::approvepgprp': t('chairman.approvalActionLabels.blagorostPropertyStatement'),
  'capital::act2pgprp': t('chairman.approvalActionLabels.blagorostPropertyAct'),
  'edubridge::apprvcontr': t('chairman.approvalActionLabels.eduTeacherContract'),
  'edubridge::apprvridact': t('chairman.approvalActionLabels.eduRidAct'),
  'marketplace::apprvipact': t('chairman.approvalActionLabels.marketplaceInvestPropertyAct'),
  'branch::apprliab': t('chairman.approvalActionLabels.unitChairmanLiabilityContract'),
  'branch::apprauth': t('chairman.approvalActionLabels.unitChairmanPowerOfAttorney'),
};

/**
 * Одобрения, которые нельзя отклонить — председателю совета остаётся только
 * поставить встречную подпись. Применяется к договору материальной ответственности
 * председателя участка: к моменту одобрения решение совета об учреждении участка уже
 * принято, поэтому отказ невозможен (контракт также блокирует отклонение).
 */
//
// Тот же случай — акт приёма имущества паевым взносом в кооперативный участок:
// совет уже решил принять имущество, подпись председателя исполняет решение
// (решение владельца 08.11.2026; контракт отклоняет отказ).
const non_declinable_approvals = new Set<string>(['branch::apprliab', 'branch::apprauth', 'marketplace::apprvipact']);

export const get_approval_action_label = (
  callback_contract: string,
  callback_action_approve: string,
): string => {
  const key = `${callback_contract}::${callback_action_approve}`;
  return approval_action_labels[key] ?? key;
};

export const is_approval_declinable = (
  callback_contract: string,
  callback_action_approve: string,
): boolean => {
  const key = `${callback_contract}::${callback_action_approve}`;
  return !non_declinable_approvals.has(key);
};
