import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchEstablishmentPetition } from '../Templates'

export { BranchEstablishmentPetition as Template } from '../Templates'

/** Ходатайство о создании участка: автор, название, адрес и председатель участка. */
export const Factory = defineBuilder<BranchEstablishmentPetition.Action, BranchEstablishmentPetition.Model>()({
  registry_id: BranchEstablishmentPetition.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
    chairmanUser: () => f.getUser(data.chairman, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData, chairmanUser } }) => ({
    meta,
    coop,
    vars,
    user: Format.commonUser(userData),
    branch_name: data.branch_name,
    address: data.address,
    chairman_full_name: Format.commonUser(chairmanUser).full_name_or_short_name,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
