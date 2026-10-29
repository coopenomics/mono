import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { CapitalizationToMainWalletConvertStatement } from '../Templates'

export { CapitalizationToMainWalletConvertStatement as Template } from '../Templates'

/** Заявление о трансляции паевого взноса в Цифровой Кошелёк: пайщик и сумма. */
export const Factory = defineBuilder<CapitalizationToMainWalletConvertStatement.Action, CapitalizationToMainWalletConvertStatement.Model>()({
  registry_id: CapitalizationToMainWalletConvertStatement.registry_id,
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
    amount: Format.formatAsset(data.amount),
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
