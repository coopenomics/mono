import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawGuaranteeClaimSelector = {
  id: true,
  number: true,
  status: true,
  reason: true,
  links: true,
  amount: true,
  created_at: true,
  decided_at: true,
}
const _validateGuaranteeClaim: MakeAllFieldsRequired<ValueTypes['EduGuaranteeClaim']> = rawGuaranteeClaimSelector
export const eduGuaranteeClaimSelector = Selector('EduGuaranteeClaim')(rawGuaranteeClaimSelector)

const rawGuaranteeStateSelector = {
  enrollment_id: true,
  available: true,
  guarantee_until: true,
  amount: true,
  claim: rawGuaranteeClaimSelector,
}
const _validateGuaranteeState: MakeAllFieldsRequired<ValueTypes['EduGuaranteeState']> = rawGuaranteeStateSelector
export const eduGuaranteeStateSelector = Selector('EduGuaranteeState')(rawGuaranteeStateSelector)
