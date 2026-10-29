import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchTrustedLiabilityAgreement } from '../Templates'

export { BranchTrustedLiabilityAgreement as Template } from '../Templates'

/** Договор материальной ответственности доверенного лица участка: физлицо и председатель участка. */
export const Factory = defineBuilder<BranchTrustedLiabilityAgreement.Action, BranchTrustedLiabilityAgreement.Model>()({
  registry_id: BranchTrustedLiabilityAgreement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
    trusteeUser: () => f.getUser(data.trustee, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData, trusteeUser } }) => {
    if (userData.type !== 'individual')
      throw new Error('Доверенным лицом кооперативного участка может быть только физическое лицо')
    const individual = userData.data as BranchTrustedLiabilityAgreement.Model['individual']
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
    const individual = userData.data as BranchTrustedLiabilityAgreement.Model['individual']
    return `${individual.last_name} ${individual.first_name} ${individual.middle_name}`
  },
})
