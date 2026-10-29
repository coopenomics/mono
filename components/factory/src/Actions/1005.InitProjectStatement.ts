import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { InitProjectStatement } from '../Templates'

export { InitProjectStatement as Template } from '../Templates'

/** Заявление об инициализации проекта или компонента: пайщик и данные проекта. */
export const Factory = defineBuilder<InitProjectStatement.Action, InitProjectStatement.Model>()({
  registry_id: InitProjectStatement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData } }) => ({
    meta,
    coop,
    vars,
    user: Format.commonUser(userData),
    project_name: data.project_name,
    project_hash: data.project_hash,
    component_name: data.component_name,
    component_hash: data.component_hash,
    is_component: data.is_component,
  }),
})
