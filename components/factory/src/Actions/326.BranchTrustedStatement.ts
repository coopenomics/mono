import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchTrustedStatement } from '../Templates'

export { BranchTrustedStatement as Template } from '../Templates'

/** Заявление доверенного лица участка: пайщик и участок. */
export const Factory = defineBuilder<BranchTrustedStatement.Action, BranchTrustedStatement.Model>()({
  registry_id: BranchTrustedStatement.registry_id,
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
    braname: data.braname,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
