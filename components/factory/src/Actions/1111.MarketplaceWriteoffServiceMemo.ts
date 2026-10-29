import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { MarketplaceWriteoffServiceMemo } from '../Templates'

export { MarketplaceWriteoffServiceMemo as Template } from '../Templates'

/** Служебная записка о списании на участке: председатель участка и позиции из данных. */
export const Factory = defineBuilder<MarketplaceWriteoffServiceMemo.Action, MarketplaceWriteoffServiceMemo.Model>()({
  registry_id: MarketplaceWriteoffServiceMemo.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    user: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, user } }) => ({
    meta,
    coop,
    vars,
    chairman: Format.commonUser(user),
    program: { name: 'Стол заказов' },
    proposal_hash: data.proposal_hash,
    branch_name: data.branch_name,
    cycle_started_at: data.cycle_started_at,
    items: data.items.map(it => ({
      asset_title: it.asset_title,
      quantity: it.quantity,
      unit: it.unit,
      amount: it.amount,
      reason: it.reason,
    })),
    total_amount: data.total_amount,
  }),
  signer: ({ reads: { user } }) => Format.commonUser(user).full_name_or_short_name,
})
