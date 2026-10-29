import { defineBuilder } from '../Builder'
import { DecisionOfParticipantExit } from '../Templates'

export { DecisionOfParticipantExit as Template } from '../Templates'

/** Решение совета о выходе пайщика: пайщик, кооператив и голоса по решению. */
export const Factory = defineBuilder<DecisionOfParticipantExit.Action, DecisionOfParticipantExit.Model>()({
  registry_id: DecisionOfParticipantExit.registry_id,
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
