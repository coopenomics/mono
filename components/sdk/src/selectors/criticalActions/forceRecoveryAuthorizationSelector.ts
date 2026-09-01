import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawForceRecoveryAuthorizationSelector = {
  authorized: true,
  consent_via: true,
  triggered_by: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['ForceRecoveryAuthorization']> = rawForceRecoveryAuthorizationSelector

export const forceRecoveryAuthorizationSelector = Selector('ForceRecoveryAuthorization')(rawForceRecoveryAuthorizationSelector)
