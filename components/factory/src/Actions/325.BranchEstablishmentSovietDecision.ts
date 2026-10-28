import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchEstablishmentSovietDecision } from '../Templates'

export { BranchEstablishmentSovietDecision as Template } from '../Templates'

/** Решение совета о создании участка: голоса по решению (иначе по утверждению) и председатель участка. */
export const Factory = defineBuilder<BranchEstablishmentSovietDecision.Action, BranchEstablishmentSovietDecision.Model>()({
  registry_id: BranchEstablishmentSovietDecision.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    chairmanUser: () => f.getUser(data.chairman, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: async () => {
      try {
        return await f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone)
      }
      catch {
        return f.getApprovedDecision(coop, data.coopname, data.decision_id)
      }
    },
  }),
  assemble: ({ data, meta, reads: { coop, vars, chairmanUser }, derived: { decision } }) => ({
    meta,
    coop,
    vars,
    decision,
    branch_name: data.branch_name,
    address: data.address,
    chairman_full_name: Format.commonUser(chairmanUser).full_name_or_short_name,
  }),
  signer: ({ reads: { coop } }) => `${coop.chairman.last_name} ${coop.chairman.first_name} ${coop.chairman.middle_name}`,
})
