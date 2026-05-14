import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawFieldErrorSelector = {
  path: true,
  message: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['FieldError']> = rawFieldErrorSelector

export type fieldErrorModel = ModelTypes['FieldError']
export const fieldErrorSelector = Selector('FieldError')(rawFieldErrorSelector)
