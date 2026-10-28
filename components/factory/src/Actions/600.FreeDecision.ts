import type { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import { FreeDecision } from '../Templates'

export { FreeDecision as Template } from '../Templates'

/** Свободное решение совета: автор, кооператив, проект решения и голоса. */
export const Factory = defineBuilder<FreeDecision.Action, FreeDecision.Model>()({
  registry_id: FreeDecision.registry_id,
  version: 1,
  reads: ({ data, f }) => {
    if (!data.project_id)
      throw new Error('Идентификатор проекта не установлен')
    return {
      user: () => f.getUser(data.username, data.block_num),
      coop: () => f.getCooperative(data.coopname, data.block_num),
      project: () => f.getProject(data.project_id, data.block_num) as Promise<Cooperative.Document.IProjectData>,
      vars: () => f.getVars(data.coopname, data.block_num),
    }
  },
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ meta, reads: { user, coop, project, vars }, derived: { decision } }) => ({
    [user.type]: user.data,
    meta,
    coop,
    decision,
    project,
    vars,
  }),
})
