import { defineBuilder } from '../Builder'
import { CapitalizationPropertyInvestDecision } from '../Templates'

export { CapitalizationPropertyInvestDecision as Template } from '../Templates'

/** Решение об имущественном взносе в капитализацию: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<CapitalizationPropertyInvestDecision.Action, CapitalizationPropertyInvestDecision.Model>()({
  registry_id: CapitalizationPropertyInvestDecision.registry_id,
  version: 1,
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
