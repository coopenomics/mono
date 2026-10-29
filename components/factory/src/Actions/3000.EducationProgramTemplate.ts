import { defineBuilder } from '../Builder'
import { EducationProgramTemplate } from '../Templates'

export { EducationProgramTemplate as Template } from '../Templates'

/** Положение ЦПП «Образование»: реквизиты кооператива и переменные. */
export const Factory = defineBuilder<EducationProgramTemplate.Action, EducationProgramTemplate.Model>()({
  registry_id: EducationProgramTemplate.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars } }) => ({ meta, coop, vars }),
})
