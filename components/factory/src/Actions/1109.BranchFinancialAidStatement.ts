import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchFinancialAidStatement } from '../Templates'

export { BranchFinancialAidStatement as Template } from '../Templates'

/** Заявление о финансовой помощи участку: пайщик, участок и сумма. */
export const Factory = defineBuilder<BranchFinancialAidStatement.Action, BranchFinancialAidStatement.Model>()({
  registry_id: BranchFinancialAidStatement.registry_id,
  version: 1,
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
    aid_hash: data.aid_hash,
    braname: data.braname,
    amount: Format.formatAsset(data.amount),
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
