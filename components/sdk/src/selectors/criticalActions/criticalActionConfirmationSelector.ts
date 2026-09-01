import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawCriticalActionConfirmationSelector = {
  by: true,
  at: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CriticalActionConfirmation']> = rawCriticalActionConfirmationSelector

export const criticalActionConfirmationSelector = Selector('CriticalActionConfirmation')(rawCriticalActionConfirmationSelector)
