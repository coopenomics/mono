import { defineBuilder } from '../Builder'
import { InitProjectDecision } from '../Templates'

export { InitProjectDecision as Template } from '../Templates'

/** Решение совета об инициализации проекта: пайщик, данные проекта и голоса по решению. */
export const Factory = defineBuilder<InitProjectDecision.Action, InitProjectDecision.Model>()({
  registry_id: InitProjectDecision.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    user: () => f.getUser(data.username, data.block_num),
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ data, meta, reads: { user, coop, vars }, derived: { decision } }) => ({
    [user.type]: user.data,
    meta,
    coop,
    decision,
    project_name: data.project_name,
    project_hash: data.project_hash,
    component_name: data.component_name,
    component_hash: data.component_hash,
    is_component: data.is_component,
    vars,
  }),
})
