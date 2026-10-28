import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import { BlagorostProgramTemplate } from '../Templates'

export { BlagorostProgramTemplate as Template } from '../Templates'

/**
 * Положение ЦПП «Благорост»: реквизиты кооператива и параметры программы из
 * приватных данных. Переменные и кооператив читаются без границы блока, как
 * у прежнего сборщика.
 */
export const Factory = defineBuilder<BlagorostProgramTemplate.Action, BlagorostProgramTemplate.Model>()({
  registry_id: BlagorostProgramTemplate.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    vars: () => f.getVars(data.coopname),
    coop: () => f.getCooperative(data.coopname),
    docData: () => f.loadDocData<BlagorostProgramTemplate.Model['doc_data']>(data),
  }),
  assemble: ({ meta, reads: { vars, coop, docData } }) => ({
    meta,
    coop,
    vars,
    doc_data: Cooperative.Registry.requireCapitalProgramPrivateData(docData, BlagorostProgramTemplate.registry_id),
  }),
})
