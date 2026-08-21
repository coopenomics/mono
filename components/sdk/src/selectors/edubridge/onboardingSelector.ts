import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawOfferStateSelector = {
  kind: true,
  requires_gate: true,
  source: true,
  registry_id: true,
  signed_at: true,
}
const _validateOfferState: MakeAllFieldsRequired<ValueTypes['EduOfferState']> = rawOfferStateSelector

const rawOnboardingStateSelector = {
  parent: rawOfferStateSelector,
  teacher: rawOfferStateSelector,
}
const _validateOnboardingState: MakeAllFieldsRequired<ValueTypes['EduOnboardingState']> = rawOnboardingStateSelector

export const eduOnboardingStateSelector = Selector('EduOnboardingState')(rawOnboardingStateSelector)
