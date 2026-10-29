import { defineBuilder } from '../Builder'
import { BranchTrusteePowerOfAttorney } from '../Templates'

export { BranchTrusteePowerOfAttorney as Template } from '../Templates'

/** Доверенность председателю участка: физлицо, название и адрес участка. */
export const Factory = defineBuilder<BranchTrusteePowerOfAttorney.Action, BranchTrusteePowerOfAttorney.Model>()({
  registry_id: BranchTrusteePowerOfAttorney.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData } }) => {
    if (userData.type !== 'individual')
      throw new Error('Председателем кооперативного участка может быть только физическое лицо')
    const individual = userData.data as BranchTrusteePowerOfAttorney.Model['individual']
    return {
      meta,
      coop,
      vars,
      individual,
      branch_name: data.branch_name,
      branch_address: data.branch_address,
    }
  },
  signer: ({ reads: { userData } }) => {
    const individual = userData.data as BranchTrusteePowerOfAttorney.Model['individual']
    return `${individual.last_name} ${individual.first_name} ${individual.middle_name}`
  },
})
