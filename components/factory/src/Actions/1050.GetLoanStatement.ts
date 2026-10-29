import { defineBuilder } from '../Builder'
import { GetLoanStatement } from '../Templates'

export { GetLoanStatement as Template } from '../Templates'

/** Заявление о займе: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<GetLoanStatement.Action, GetLoanStatement.Model>()({
  registry_id: GetLoanStatement.registry_id,
  version: '1.0',
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
