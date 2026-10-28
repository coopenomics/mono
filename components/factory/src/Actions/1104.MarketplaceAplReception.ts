import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { MarketplaceAplReception } from '../Templates'
import { splitCreatedAt } from '../Utils/documentCreatedAt'

export { MarketplaceAplReception as Template } from '../Templates'

/** Числовая строка без лишних нулей; не число — как есть. */
function cleanNum(s: string): string {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? String(n) : s
}

/**
 * Акт приёма-передачи имущества на участке: поставщик («Передал»), оператор
 * участка («Получил»), переданное имущество из данных заказа.
 */
export const Factory = defineBuilder<MarketplaceAplReception.Action, MarketplaceAplReception.Model>()({
  registry_id: MarketplaceAplReception.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    user: () => f.getUser(data.username, data.block_num),
    transmitter: () => f.getUser(data.transmitter, data.block_num),
  }),
  derive: ({ data, f, reads: { coop } }) => ({
    branch: async () => {
      if (coop.is_branched && !data.braname)
        throw new Error('Branch name is required')
      return data.braname ? f.getOrganization(data.braname, data.block_num) : undefined
    },
  }),
  assemble: ({ data, meta, reads: { coop, vars, user, transmitter }, derived: { branch } }) => ({
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
    decision: {
      id: 0,
      ...splitCreatedAt(meta.created_at, meta.timezone),
      votes_for: 0,
      votes_against: 0,
      votes_abstained: 0,
      voters_percent: 0,
    },
    program: { name: 'Стол заказов' },
    act_id: data.act_id,
    transmitter: Format.firstLastMiddleName(transmitter.data),
    branch,
  }),
  signer: ({ reads: { user } }) => Format.commonUser(user).full_name_or_short_name,
})
