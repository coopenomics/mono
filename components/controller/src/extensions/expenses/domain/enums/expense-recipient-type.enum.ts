import { registerEnumType } from '@nestjs/graphql';
import { InnerExpenseRecipientType } from '@coopenomics/innercoop';

/**
 * Перечень живёт в межрасширенческом контракте: с ним сверяются расширения,
 * заказывающие расход, а шасси остаётся его владельцем и регистрирует перечень
 * в схеме. Здесь он доступен под привычным шасси именем.
 */
export { InnerExpenseRecipientType as ExpenseRecipientType };

registerEnumType(InnerExpenseRecipientType, {
  name: 'ExpenseRecipientType',
  description: 'Тип получателя платежа.',
});
