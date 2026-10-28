import { defineBuilder } from '../Builder'
import { PrivacyPolicy } from '../Templates'
import { isEmpty } from '../Utils'

export { PrivacyPolicy as Template } from '../Templates'

/** Политика конфиденциальности: реквизиты кооператива и протокол утверждения. */
export const Factory = defineBuilder<PrivacyPolicy.Action, PrivacyPolicy.Model>()({
  registry_id: PrivacyPolicy.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars } }) => {
    if (!vars?.privacy_agreement || isEmpty(vars.privacy_agreement.protocol_number) || isEmpty(vars.privacy_agreement.protocol_day_month_year))
      throw new Error('Реквизиты протокола по политике конфиденциальности не заполнены. Добавьте номер и дату протокола в настройках кооператива.')
    return { meta, coop, vars }
  },
})
