import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ExpenseProposalStatement } from '../Templates'

export { ExpenseProposalStatement as Template } from '../Templates'

/** Служебная записка-смета о расходах: автор, позиции и их приватные реквизиты по номеру. */
export const Factory = defineBuilder<ExpenseProposalStatement.Action, ExpenseProposalStatement.Model>()({
  registry_id: ExpenseProposalStatement.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
    priv: () => f.loadDocData<ExpenseProposalStatement.PrivateData>(data),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData, priv } }) => {
    const privByNumber = new Map(
      (priv?.items ?? []).map((p): [string, ExpenseProposalStatement.PrivateData['items'][number]] => [p.number, p]),
    )
    return {
      meta,
      coop,
      user: Format.commonUser(userData),
      vars,
      proposal_hash: data.proposal_hash,
      proposal_short_hash: Format.shortHash(data.proposal_hash),
      proposal: { ...data.proposal, total_amount: Format.formatAsset(data.proposal.total_amount) },
      items: data.items.map((item) => {
        const p = privByNumber.get(item.number)
        return {
          ...item,
          amount: Format.formatAsset(item.amount),
          recipient_name: p?.recipient_name,
          requisites: p?.requisites,
          payment_purpose: p?.payment_purpose,
        }
      }),
    }
  },
})
