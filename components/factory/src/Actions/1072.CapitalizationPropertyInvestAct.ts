import { defineBuilder } from '../Builder'
import { CapitalizationPropertyInvestAct } from '../Templates'

export { CapitalizationPropertyInvestAct as Template } from '../Templates'

/** Акт об имущественном взносе в капитализацию: только мета, остальное в тексте шаблона. */
export const Factory = defineBuilder<CapitalizationPropertyInvestAct.Action, CapitalizationPropertyInvestAct.Model>()({
  registry_id: CapitalizationPropertyInvestAct.registry_id,
  version: '1.0',
  reads: () => ({}),
  assemble: ({ meta }) => ({ meta }),
})
