const approval_action_labels: Record<string, string> = {
  'capital::apprvappndx': 'Допуск к проекту по приложению Благороста',
  'capital::approvereg': 'Договор УХД по приложению Благороста',
  'capital::approveinvst': 'Заявление на инвестицию в проект по приложению Благороста',
  'capital::approverslt': 'Внесение РИД по проекту Благороста',
  'branch::apprliab': 'Договор о материальной ответственности председателя участка',
};

/**
 * Одобрения, которые нельзя отклонить — председателю совета остаётся только
 * поставить встречную подпись. Применяется к договору материальной ответственности
 * председателя участка: к моменту одобрения решение совета об учреждении участка уже
 * принято, поэтому отказ невозможен (контракт также блокирует отклонение).
 */
const non_declinable_approvals = new Set<string>(['branch::apprliab']);

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
