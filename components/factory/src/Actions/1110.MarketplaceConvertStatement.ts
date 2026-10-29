import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { MarketplaceConvertStatement } from '../Templates'

export { MarketplaceConvertStatement as Template } from '../Templates'

/** Заявление о конвертации паевого взноса в членский (Стол заказов): пайщик, заказ и суммы. */
export const Factory = defineBuilder<MarketplaceConvertStatement.Action, MarketplaceConvertStatement.Model>()({
  registry_id: MarketplaceConvertStatement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData } }) => ({
    meta,
    coop,
    vars,
    user: Format.commonUser(userData),
    program: { name: 'Стол заказов' },
    order_hash: data.order_hash,
    amount: Format.formatAsset(data.amount),
    membership_fee: Format.formatAsset(data.membership_fee),
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
