import { defineBuilder } from '../Builder'
import { GenerationPropertyInvestDecision } from '../Templates'

export { GenerationPropertyInvestDecision as Template } from '../Templates'

/** Решение об имущественном взносе в генерацию: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<GenerationPropertyInvestDecision.Action, GenerationPropertyInvestDecision.Model>()({
  registry_id: GenerationPropertyInvestDecision.registry_id,
  version: 1,
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
