import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawAccessGrantSelector } from './accessGrantSelector'

export const rawCapabilitySetSelector = {
  set_key: true,
  title: true,
  description: true,
  builtin: true,
  coopname: true,
  grants: rawAccessGrantSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapabilitySet']> = rawCapabilitySetSelector

export const capabilitySetSelector = Selector('CapabilitySet')(rawCapabilitySetSelector)
