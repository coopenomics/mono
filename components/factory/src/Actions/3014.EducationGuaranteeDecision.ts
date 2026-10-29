import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationGuaranteeDecision } from '../Templates'

export { EducationGuaranteeDecision as Template } from '../Templates'

/** Протокол совета об аннулировании Подписки по Гарантийным условиям: пайщик, Подписка и голоса по решению. */
export const Factory = defineBuilder<EducationGuaranteeDecision.Action, EducationGuaranteeDecision.Model>()({
  registry_id: EducationGuaranteeDecision.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData }, derived: { decision } }) => ({
    meta,
    coop,
    vars,
    decision,
    user: Format.commonUser(userData),
    claim_hash: data.claim_hash,
    claim_short_hash: Format.shortHash(data.claim_hash, 8),
    course_title: data.course_title,
    amount: Format.formatAsset(data.amount),
  }),
})
