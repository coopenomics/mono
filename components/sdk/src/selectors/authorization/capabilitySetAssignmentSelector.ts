import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawCapabilitySetAssignmentSelector = {
  username: true,
  set_key: true,
  granted_by: true,
  granted_at: true,
  expires_at: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapabilitySetAssignment']> = rawCapabilitySetAssignmentSelector

export const capabilitySetAssignmentSelector = Selector('CapabilitySetAssignment')(rawCapabilitySetAssignmentSelector)
