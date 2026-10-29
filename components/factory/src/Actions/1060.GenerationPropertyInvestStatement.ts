import { defineBuilder } from '../Builder'
import { GenerationPropertyInvestStatement } from '../Templates'

export { GenerationPropertyInvestStatement as Template } from '../Templates'

/** Заявление об имущественном взносе в генерацию: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<GenerationPropertyInvestStatement.Action, GenerationPropertyInvestStatement.Model>()({
  registry_id: GenerationPropertyInvestStatement.registry_id,
  version: '1.0',
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
