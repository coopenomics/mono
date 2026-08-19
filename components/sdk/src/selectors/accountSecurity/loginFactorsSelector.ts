import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawLoginFactorsSelector = {
  totp_enrolled: true,
  totp_enabled: true,
  email_available: true,
  email_enabled: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['LoginFactors']> = rawLoginFactorsSelector

export const loginFactorsSelector = Selector('LoginFactors')(rawLoginFactorsSelector)
