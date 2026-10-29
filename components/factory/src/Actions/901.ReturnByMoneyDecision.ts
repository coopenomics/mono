import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ReturnByMoneyDecision } from '../Templates'

export { ReturnByMoneyDecision as Template } from '../Templates'

/** Решение совета о возврате паевого взноса деньгами: пайщик и голоса по решению. */
export const Factory = defineBuilder<ReturnByMoneyDecision.Action, ReturnByMoneyDecision.Model>()({
  registry_id: ReturnByMoneyDecision.registry_id,
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
    vars,
    meta,
    coop,
    decision,
    user: Format.commonUser(user),
    quantity: data.quantity,
    currency: data.currency,
  }),
  signer: ({ reads: { user } }) => user.data,
})
