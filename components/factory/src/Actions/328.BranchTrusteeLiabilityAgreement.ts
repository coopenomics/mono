import { defineBuilder } from '../Builder'
import { BranchTrusteeLiabilityAgreement } from '../Templates'

export { BranchTrusteeLiabilityAgreement as Template } from '../Templates'

/** Договор материальной ответственности председателя участка: физлицо. */
export const Factory = defineBuilder<BranchTrusteeLiabilityAgreement.Action, BranchTrusteeLiabilityAgreement.Model>()({
  registry_id: BranchTrusteeLiabilityAgreement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData } }) => {
    if (userData.type !== 'individual')
      throw new Error('Председателем кооперативного участка может быть только физическое лицо')
    const individual = userData.data as BranchTrusteeLiabilityAgreement.Model['individual']
    return {
      meta,
      coop,
      vars,
      individual,
      branch_name: data.branch_name,
    }
  },
  signer: ({ reads: { userData } }) => {
    const individual = userData.data as BranchTrusteeLiabilityAgreement.Model['individual']
    return `${individual.last_name} ${individual.first_name} ${individual.middle_name}`
  },
})
