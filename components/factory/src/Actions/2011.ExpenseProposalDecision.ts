import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ExpenseProposalDecision } from '../Templates'

export { ExpenseProposalDecision as Template } from '../Templates'

/** Протокол решения совета по смете расходов: голоса по решению, позиции и резолюция. */
export const Factory = defineBuilder<ExpenseProposalDecision.Action, ExpenseProposalDecision.Model>()({
  registry_id: ExpenseProposalDecision.registry_id,
  version: '1.0',
  reads: ({ data, f }) => {
    if (!data.decision_id)
      throw new Error('Идентификатор решения совета не установлен')
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
    }
  },
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ data, meta, reads: { coop, vars }, derived: { decision } }) => ({
    meta,
    coop,
    vars,
    decision,
    proposal_hash: data.proposal_hash,
    proposal_short_hash: Format.shortHash(data.proposal_hash),
    proposal: { ...data.proposal, total_amount: Format.formatAsset(data.proposal.total_amount) },
    items: data.items.map(item => ({ ...item, amount: Format.formatAsset(item.amount) })),
    resolution: data.resolution,
  }),
})
