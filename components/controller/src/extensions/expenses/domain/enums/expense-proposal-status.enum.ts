import { registerEnumType } from '@nestjs/graphql';
import { InnerExpenseProposalState } from '@coopenomics/innercoop';

/**
 * Перечень живёт в межрасширенческом контракте: с ним сверяются расширения,
 * заказывающие расход, а шасси остаётся его владельцем и регистрирует перечень
 * в схеме. Здесь он доступен под привычным шасси именем.
 */
export { InnerExpenseProposalState as ExpenseProposalStatus };

registerEnumType(InnerExpenseProposalState, {
  name: 'ExpenseProposalStatus',
  description: 'Состояние служебной записки-сметы',
});
