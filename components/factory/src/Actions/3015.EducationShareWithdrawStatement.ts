import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationShareWithdrawStatement } from '../Templates'

export { EducationShareWithdrawStatement as Template } from '../Templates'

/** Заявление о трансляции паевого взноса из Образования в Цифровой Кошелёк: пайщик и сумма. */
export const Factory = defineBuilder<EducationShareWithdrawStatement.Action, EducationShareWithdrawStatement.Model>()({
  registry_id: EducationShareWithdrawStatement.registry_id,
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
