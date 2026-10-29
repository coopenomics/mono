import { defineBuilder } from '../Builder'
import { CapitalizationPropertyInvestStatement } from '../Templates'

export { CapitalizationPropertyInvestStatement as Template } from '../Templates'

/** Заявление об имущественном взносе в капитализацию: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<CapitalizationPropertyInvestStatement.Action, CapitalizationPropertyInvestStatement.Model>()({
  registry_id: CapitalizationPropertyInvestStatement.registry_id,
  version: '1.0',
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
