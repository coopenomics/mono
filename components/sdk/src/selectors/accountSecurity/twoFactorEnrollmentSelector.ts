import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawTwoFactorEnrollmentSelector = {
  secret: true,
  otpauth_uri: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['TwoFactorEnrollment']> = rawTwoFactorEnrollmentSelector

export const twoFactorEnrollmentSelector = Selector('TwoFactorEnrollment')(rawTwoFactorEnrollmentSelector)
