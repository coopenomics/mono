import { defineBuilder } from '../Builder'
import { GetLoanDecision } from '../Templates'

export { GetLoanDecision as Template } from '../Templates'

/** Решение о займе: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<GetLoanDecision.Action, GetLoanDecision.Model>()({
  registry_id: GetLoanDecision.registry_id,
  version: 1,
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
