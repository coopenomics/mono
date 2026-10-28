import { defineBuilder } from '../Builder'
import { MarketplaceWriteoffProtocol } from '../Templates'

export { MarketplaceWriteoffProtocol as Template } from '../Templates'

/** Протокол решения совета о списании: голоса по решению и итоги списания из данных. */
export const Factory = defineBuilder<MarketplaceWriteoffProtocol.Action, MarketplaceWriteoffProtocol.Model>()({
  registry_id: MarketplaceWriteoffProtocol.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ data, meta, reads: { coop, vars }, derived: { decision } }) => ({
    meta,
    coop,
    vars,
    decision,
    proposal_hash: data.proposal_hash,
    cycle_started_at: data.cycle_started_at,
    total_amount: data.total_amount,
    items_count: data.items_count,
  }),
})
