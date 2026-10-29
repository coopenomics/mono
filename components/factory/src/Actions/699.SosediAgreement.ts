import { defineBuilder } from '../Builder'
import { SosediAgreement } from '../Templates'

export { SosediAgreement as Template } from '../Templates'

/** Соглашение ЦПП «Соседи»: только реквизиты кооператива и его переменные. */
export const Factory = defineBuilder<SosediAgreement.Action, SosediAgreement.Model>()({
  registry_id: SosediAgreement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars } }) => ({ meta, coop, vars }),
})
