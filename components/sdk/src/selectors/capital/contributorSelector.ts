import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawDocumentAggregateSelector } from '../documents/documentAggregateSelector'
import { rawCapitalProgramWalletSelector } from './capitalProgramWalletSelector'
import { baseCapitalSelector } from './baseCapitalSelector'

const rawContributorSelector = {
  ...baseCapitalSelector,
  id: true,
  block_num: true,
  status: true,
  contributor_hash: true,
  coopname: true,
  username: true,
  blockchain_status: true,
  memo: true,
  is_external_contract: true,
  rate_per_hour: true,
  hours_per_day: true,
  about: true,
  debt_amount: true,
  contributed_as_investor: true,
  contributed_as_creator: true,
  contributed_as_author: true,
  contributed_as_coordinator: true,
  contributed_as_contributor: true,
  contributed_as_propertor: true,
  created_at: true,
  contract: rawDocumentAggregateSelector,
  appendixes: true,
  display_name: true,
  energy: true,
  last_energy_update: true,
  level: true,
  program_key: true,
  blagorost_offer_hash: true,
  generator_offer_hash: true,
  generation_contract_hash: true,
  storage_agreement_hash: true,
  blagorost_agreement_hash: true,
  document_parameters: {
    blagorost_contributor_contract_number: true,
    blagorost_contributor_contract_created_at: true,
    generator_agreement_number: true,
    generator_agreement_created_at: true,
    blagorost_agreement_number: true,
    blagorost_agreement_created_at: true,
    blagorost_storage_agreement_number: true,
    blagorost_storage_agreement_created_at: true,
  },
  blagorost_wallet: rawCapitalProgramWalletSelector,
  generation_wallet: rawCapitalProgramWalletSelector,
  main_wallet: rawCapitalProgramWalletSelector,
  is_external_blagorost_agreement: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalContributor']> = rawContributorSelector

export type contributorModel = ModelTypes['CapitalContributor']

export { rawContributorSelector }

export const contributorSelector = Selector('CapitalContributor')(rawContributorSelector)
