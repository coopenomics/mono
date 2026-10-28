import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { UserAgreement } from '../Templates'
import { isEmpty } from '../Utils'

export { UserAgreement as Template } from '../Templates'

/** Место подписанта в бланке и в публичном показе: имя неизвестно. */
const BLANK_SIGNER_NAME = '____________________'

/**
 * Пользовательское соглашение: реквизиты кооператива, протокол утверждения и
 * имя подписанта. Для бланка и публичного показа подписанта нет — прочерк.
 */
export const Factory = defineBuilder<UserAgreement.Action, UserAgreement.Model>()({
  registry_id: UserAgreement.registry_id,
  version: 1,
  reads: ({ data, f, options }) => {
    const isBlank = options.blank_signer === true || isEmpty(data.username)
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      user: () => (isBlank ? Promise.resolve(null) : f.getUser(data.username, data.block_num)),
    }
  },
  assemble: ({ meta, reads: { coop, vars, user } }) => {
    if (!vars?.user_agreement || isEmpty(vars.user_agreement.protocol_number) || isEmpty(vars.user_agreement.protocol_day_month_year))
      throw new Error('Реквизиты протокола по пользовательскому соглашению не заполнены. Укажите номер и дату протокола в настройках кооператива.')
    return {
      meta,
      coop,
      vars,
      user: { full_name: user ? Format.fullName(user.data) : BLANK_SIGNER_NAME },
    }
  },
})
