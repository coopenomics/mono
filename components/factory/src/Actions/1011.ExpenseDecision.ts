import { defineBuilder } from '../Builder'
import { ExpenseDecision } from '../Templates'

export { ExpenseDecision as Template } from '../Templates'

/** Решение о расходах: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<ExpenseDecision.Action, ExpenseDecision.Model>()({
  registry_id: ExpenseDecision.registry_id,
  version: 1,
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
