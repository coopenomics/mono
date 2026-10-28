import { defineBuilder } from '../Builder'
import { WalletAgreement } from '../Templates'
import { isEmpty } from '../Utils'
import { DocumentNotApprovedError } from '../errors'

export { WalletAgreement as Template } from '../Templates'

/** Соглашение ЦПП «Цифровой Кошелёк»: реквизиты кооператива и протокол утверждения из переменных. */
export const Factory = defineBuilder<WalletAgreement.Action, WalletAgreement.Model>()({
  registry_id: WalletAgreement.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars } }) => {
    if (!vars?.wallet_agreement || isEmpty(vars.wallet_agreement.protocol_number) || isEmpty(vars.wallet_agreement.protocol_day_month_year))
      throw new DocumentNotApprovedError('Реквизиты протокола для соглашения о ЦПП не заполнены. Укажите их в настройках кооператива и повторите генерацию.')
    return { meta, coop, vars }
  },
})
