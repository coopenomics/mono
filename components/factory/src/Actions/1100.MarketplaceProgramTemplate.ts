import { defineBuilder } from '../Builder'
import { MarketplaceProgramTemplate } from '../Templates'

export { MarketplaceProgramTemplate as Template } from '../Templates'

/** Положение ЦПП «Стол заказов»: реквизиты кооператива и переменные. */
export const Factory = defineBuilder<MarketplaceProgramTemplate.Action, MarketplaceProgramTemplate.Model>()({
  registry_id: MarketplaceProgramTemplate.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars } }) => ({ meta, coop, vars }),
})
