import { registerEnumType } from '@nestjs/graphql';
import { InnerExpenseItemState } from '@coopenomics/innercoop';

/**
 * Перечень живёт в межрасширенческом контракте: с ним сверяются расширения,
 * заказывающие расход, а шасси остаётся его владельцем и регистрирует перечень
 * в схеме. Здесь он доступен под привычным шасси именем.
 */
export { InnerExpenseItemState as ExpenseItemStatus };

registerEnumType(InnerExpenseItemState, {
  name: 'ExpenseItemStatus',
  description: 'Статус строки расхода.',
});
