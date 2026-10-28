import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationRidDecision } from '../Templates'
import { getEducationContractRef } from '../Utils/educationContractRef'

export { EducationRidDecision as Template } from '../Templates'

/** Протокол совета о приёме результата преподавателя: реквизиты договора УХД, результат и голоса по решению. */
export const Factory = defineBuilder<EducationRidDecision.Action, EducationRidDecision.Model>()({
  registry_id: EducationRidDecision.registry_id,
  version: 1,
  reads: ({ data, f, s }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
    contract: () => getEducationContractRef(s, data),
  }),
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData, contract }, derived: { decision } }) => ({
    meta,
    coop,
    vars,
    decision,
    user: Format.commonUser(userData),
    program: { name: 'Образование' },
    ...contract,
    rid_short_hash: Format.shortHash(data.rid_hash),
    rid_type_human: Cooperative.Registry.educationRidTypeLabel(data.rid_type ?? 'other'),
    rid_hash: data.rid_hash,
    amount: Format.formatAsset(data.amount),
  }),
})
