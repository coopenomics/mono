import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import { GeneratorProgramTemplate } from '../Templates'

export { GeneratorProgramTemplate as Template } from '../Templates'

/**
 * Положение ЦПП «Генератор»: реквизиты кооператива и параметры программы из
 * приватных данных. Переменные и кооператив читаются без границы блока — так
 * было у прежнего сборщика, шаг 3 поведение не меняет.
 */
export const Factory = defineBuilder<GeneratorProgramTemplate.Action, GeneratorProgramTemplate.Model>()({
  registry_id: GeneratorProgramTemplate.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    vars: () => f.getVars(data.coopname),
    coop: () => f.getCooperative(data.coopname),
    docData: () => f.loadDocData<GeneratorProgramTemplate.Model['doc_data']>(data),
  }),
  assemble: ({ meta, reads: { vars, coop, docData } }) => ({
    meta,
    coop,
    vars,
    doc_data: Cooperative.Registry.requireCapitalProgramPrivateData(docData, GeneratorProgramTemplate.registry_id),
  }),
})
