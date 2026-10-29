import type { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ProjectFreeDecision } from '../Templates'

export { ProjectFreeDecision as Template } from '../Templates'

/**
 * Проект свободного решения: автор, кооператив, проект решения. Заголовок
 * меты — из данных или проекта (до 200 знаков), иначе из шаблона.
 */
export const Factory = defineBuilder<ProjectFreeDecision.Action, ProjectFreeDecision.Model>()({
  registry_id: ProjectFreeDecision.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    user: () => f.getUser(data.username, data.block_num),
    coop: () => f.getCooperative(data.coopname, data.block_num),
    project: () => f.getProject(data.project_id, data.block_num) as Promise<Cooperative.Document.IProjectData>,
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  meta: ({ data, template, reads: { project } }) => ({
    ...data,
    title: data.title?.trim()?.substring(0, 200)
      || project.title?.trim()?.substring(0, 200)
      || template.title,
  }),
  assemble: ({ meta, reads: { user, coop, project, vars } }) => ({
    [user.type]: user.data,
    vars,
    meta,
    coop,
    project,
    suggester_name: Format.fullName(user.data),
  }),
})
