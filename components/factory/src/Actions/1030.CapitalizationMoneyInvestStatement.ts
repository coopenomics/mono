import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { CapitalizationMoneyInvestStatement } from '../Templates'

export { CapitalizationMoneyInvestStatement as Template } from '../Templates'

/** Заявление о денежном взносе в капитализацию: пайщик и переменные кооператива. */
export const Factory = defineBuilder<CapitalizationMoneyInvestStatement.Action, CapitalizationMoneyInvestStatement.Model>()({
  registry_id: CapitalizationMoneyInvestStatement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { vars, userData } }) => ({
    meta,
    vars,
    common_user: Format.commonUser(userData),
    amount: Format.formatAsset(data.amount),
  }),
})
