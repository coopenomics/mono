import { defineBuilder } from '../Builder'
import { DecisionOfParticipantApplication } from '../Templates'

export { DecisionOfParticipantApplication as Template } from '../Templates'

/**
 * Решение совета о приёме пайщика: пайщик любого вида, реквизиты кооператива
 * и итоги голосования по решению. Голоса читаются второй волной — им нужна
 * дата из меты.
 */
export const Factory = defineBuilder<DecisionOfParticipantApplication.Action, DecisionOfParticipantApplication.Model>()({
  registry_id: DecisionOfParticipantApplication.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    user: () => f.getUser(data.username, data.block_num),
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ meta, reads: { user, coop, vars }, derived: { decision } }) => ({
    [user.type]: user.data,
    vars,
    meta,
    coop,
    type: user.type,
    decision,
  }),
  signer: ({ reads: { user } }) => user.data,
})
