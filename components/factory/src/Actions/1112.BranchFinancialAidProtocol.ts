import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchFinancialAidProtocol } from '../Templates'

export { BranchFinancialAidProtocol as Template } from '../Templates'

/** Протокол совета о финансовой помощи участку: получатель, участок, сумма и голоса по решению. */
export const Factory = defineBuilder<BranchFinancialAidProtocol.Action, BranchFinancialAidProtocol.Model>()({
  registry_id: BranchFinancialAidProtocol.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    receiverData: () => f.getUser(data.receiver, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ data, meta, reads: { coop, vars, receiverData }, derived: { decision } }) => ({
    meta,
    coop,
    vars,
    decision,
    aid_hash: data.aid_hash,
    receiver: Format.commonUser(receiverData),
    braname: data.braname,
    amount: Format.formatAsset(data.amount),
  }),
})
