import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ReturnByMoney } from '../Templates'

export { ReturnByMoney as Template } from '../Templates'

/** Заявление на возврат паевого взноса деньгами: пайщик и его способ оплаты. */
export const Factory = defineBuilder<ReturnByMoney.Action, ReturnByMoney.Model>()({
  registry_id: ReturnByMoney.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    user: () => f.getUser(data.username, data.block_num),
    paymentMethod: () => f.getPaymentMethod({ method_id: data.method_id, username: data.username, deleted: false }),
  }),
  assemble: ({ data, meta, reads: { coop, vars, user, paymentMethod } }) => {
    const commonUser = Format.commonUser(user)
    if (!paymentMethod)
      throw new Error(`Платежный метод с ID ${data.method_id} не найден для пользователя ${data.username}`)
    return {
      meta,
      coop,
      vars,
      user: commonUser,
      payment_details: Format.paymentDetails(paymentMethod, commonUser.full_name_or_short_name),
      quantity: Format.formatAsset(data.quantity),
      currency: data.currency,
      payment_hash: data.payment_hash,
    }
  },
  signer: ({ reads: { user } }) => Format.commonUser(user).full_name_or_short_name,
})
