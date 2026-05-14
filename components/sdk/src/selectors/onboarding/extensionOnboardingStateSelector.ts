import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus'

const extensionOnboardingStepStateFields = {
  step_key: true,
  done: true,
  hash: true,
  order: true,
  default_title: true,
}

const extensionOnboardingStateFields = {
  extension_name: true,
  steps: extensionOnboardingStepStateFields,
  onboarding_init_at: true,
  onboarding_expire_at: true,
  all_done: true,
}

const _validateStep: MakeAllFieldsRequired<ValueTypes['ExtensionOnboardingStepState']> =
  extensionOnboardingStepStateFields
const _validate: MakeAllFieldsRequired<ValueTypes['ExtensionOnboardingState']> =
  extensionOnboardingStateFields

export const extensionOnboardingStateSelector = Selector('ExtensionOnboardingState')(
  extensionOnboardingStateFields
)
