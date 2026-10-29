import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { MarketplaceShareReturnDecision } from '../Templates'

export { MarketplaceShareReturnDecision as Template } from '../Templates'

/** Числовая строка без лишних нулей; не число — как есть. */
function cleanNum(s: string): string {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? String(n) : s
}

/** Решение совета о выдаче товара паевым взносом: пайщик, имущество и голоса по решению. */
export const Factory = defineBuilder<MarketplaceShareReturnDecision.Action, MarketplaceShareReturnDecision.Model>()({
  registry_id: MarketplaceShareReturnDecision.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    user: () => f.getUser(data.username, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { coop } }) => ({
    decision: () => f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone),
  }),
  assemble: ({ data, meta, reads: { coop, vars, user }, derived: { decision } }) => ({
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
    decision,
    program: { name: 'Стол заказов' },
  }),
})
