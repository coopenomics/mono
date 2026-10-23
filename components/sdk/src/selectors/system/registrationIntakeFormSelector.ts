import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawRegistrationIntakeFormSelector = {
  id: true,
  title: true,
  description: true,
  schema: true,
  order: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['RegistrationIntakeForm']> = rawRegistrationIntakeFormSelector

export const registrationIntakeFormSelector = Selector('RegistrationIntakeForm')(rawRegistrationIntakeFormSelector)
