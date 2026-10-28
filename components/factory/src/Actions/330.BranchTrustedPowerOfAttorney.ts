import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchTrustedPowerOfAttorney } from '../Templates'

export { BranchTrustedPowerOfAttorney as Template } from '../Templates'

/** Доверенность доверенному лицу участка: физлицо и председатель участка. */
export const Factory = defineBuilder<BranchTrustedPowerOfAttorney.Action, BranchTrustedPowerOfAttorney.Model>()({
  registry_id: BranchTrustedPowerOfAttorney.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
    trusteeUser: () => f.getUser(data.trustee, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData, trusteeUser } }) => {
    if (userData.type !== 'individual')
      throw new Error('Доверенным лицом кооперативного участка может быть только физическое лицо')
    const individual = userData.data as BranchTrustedPowerOfAttorney.Model['individual']
    return {
      meta,
      coop,
      vars,
      individual,
      branch_name: data.branch_name,
      trustee_full_name: Format.commonUser(trusteeUser).full_name_or_short_name,
    }
  },
  signer: ({ reads: { userData } }) => {
    const individual = userData.data as BranchTrustedPowerOfAttorney.Model['individual']
    return `${individual.last_name} ${individual.first_name} ${individual.middle_name}`
  },
})
