import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const onboardingStateFields = {
  generator_program_template_done: true,
  onboarding_generator_program_template_hash: true,
  generation_contract_template_done: true,
  onboarding_generation_contract_template_hash: true,
  generator_offer_template_done: true,
  onboarding_generator_offer_template_hash: true,
  blagorost_provision_done: true,
  onboarding_blagorost_provision_hash: true,
  blagorost_offer_template_done: true,
  onboarding_blagorost_offer_template_hash: true,
  capital_program_doc_data_hash: true,
  onboarding_init_at: true,
  onboarding_expire_at: true,
} as const

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalOnboardingState']> = onboardingStateFields

export const capitalOnboardingStateSelector = Selector('CapitalOnboardingState')(onboardingStateFields)
