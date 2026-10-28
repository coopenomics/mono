import { defineBuilder } from '../Builder'
import { GenerationPropertyInvestAct } from '../Templates'

export { GenerationPropertyInvestAct as Template } from '../Templates'

/** Акт об имущественном взносе в генерацию: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<GenerationPropertyInvestAct.Action, GenerationPropertyInvestAct.Model>()({
  registry_id: GenerationPropertyInvestAct.registry_id,
  version: 1,
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
