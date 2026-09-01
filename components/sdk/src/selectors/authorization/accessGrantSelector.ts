import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawAccessGrantSelector = {
  action: true,
  resource: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['AccessGrant']> = rawAccessGrantSelector

export const accessGrantSelector = Selector('AccessGrant')(rawAccessGrantSelector)
