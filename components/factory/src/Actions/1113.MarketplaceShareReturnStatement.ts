import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { MarketplaceShareReturnStatement } from '../Templates'

export { MarketplaceShareReturnStatement as Template } from '../Templates'

/** Числовая строка без лишних нулей; не число — как есть. */
function cleanNum(s: string): string {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? String(n) : s
}

/** Заявление на выдачу товара паевым взносом: пайщик, имущество из данных заказа, участок. */
export const Factory = defineBuilder<MarketplaceShareReturnStatement.Action, MarketplaceShareReturnStatement.Model>()({
  registry_id: MarketplaceShareReturnStatement.registry_id,
  version: 1,
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
      units: data.fact_quantity,
      unit_cost: cleanNum(data.unit_cost),
      total_cost: cleanNum(data.total_amount),
      currency: data.currency,
      type: 'receive',
      program_id: 0,
    },
    program: { name: 'Стол заказов' },
    branch,
  }),
  signer: ({ reads: { user } }) => Format.commonUser(user).full_name_or_short_name,
})
