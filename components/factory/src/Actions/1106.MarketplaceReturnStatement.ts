import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { MarketplaceReturnStatement } from '../Templates'

export { MarketplaceReturnStatement as Template } from '../Templates'

/** Рекламация пайщика о гарантийном возврате имущества: пайщик, имущество из данных заказа, участок. */
export const Factory = defineBuilder<MarketplaceReturnStatement.Action, MarketplaceReturnStatement.Model>()({
  registry_id: MarketplaceReturnStatement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    user: () => f.getUser(data.username, data.block_num),
  }),
  derive: ({ data, f, reads: { coop } }) => ({
    branch: async () => {
      if (coop.is_branched && !data.braname)
        throw new Error('Branch name is required')
      return data.braname ? f.getOrganization(data.braname, data.block_num) : undefined
    },
  }),
  assemble: ({ data, meta, reads: { coop, vars, user }, derived: { branch } }) => ({
    meta,
    coop,
    vars,
    user: Format.commonUser(user),
    request: {
      hash: data.sku,
      title: data.product_title,
      unit_of_measurement: data.unit_of_measurement,
      units: data.actual_quantity,
      unit_cost: data.unit_cost,
      total_cost: data.fact_cost,
      currency: data.currency,
      type: 'receive',
      program_id: 0,
    },
    program: { name: 'Стол заказов' },
    fact_cost: data.fact_cost,
    actual_quantity: String(data.actual_quantity),
    reason_text: data.reason_text,
    branch,
  }),
  signer: ({ reads: { user } }) => Format.commonUser(user).full_name_or_short_name,
})
