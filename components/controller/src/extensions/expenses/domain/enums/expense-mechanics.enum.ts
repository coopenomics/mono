import { registerEnumType } from '@nestjs/graphql';
import { InnerExpenseMechanics } from '@coopenomics/innercoop';

/**
 * Перечень живёт в межрасширенческом контракте: с ним сверяются расширения,
 * заказывающие расход, а шасси остаётся его владельцем и регистрирует перечень
 * в схеме. Здесь он доступен под привычным шасси именем.
 */
export { InnerExpenseMechanics as ExpenseMechanics };

registerEnumType(InnerExpenseMechanics, {
  name: 'ExpenseMechanics',
  description: 'Способ оплаты строки расхода.',
});
