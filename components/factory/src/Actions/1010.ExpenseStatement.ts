import { defineBuilder } from '../Builder'
import { ExpenseStatement } from '../Templates'

export { ExpenseStatement as Template } from '../Templates'

/** Заявление о расходах: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<ExpenseStatement.Action, ExpenseStatement.Model>()({
  registry_id: ExpenseStatement.registry_id,
  version: '1.0',
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
