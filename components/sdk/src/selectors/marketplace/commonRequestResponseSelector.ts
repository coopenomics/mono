import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

// Определяем объект вручную, чтобы избежать потери типов
export const rawCommonRequestSelector = {
  hash: true,
  title: true,
  unit_of_measurement: true,
  units: true,
  unit_cost: true,
  total_cost: true,
  currency: true,
  type: true,
  program_id: true,
}

// // Проверяем raw на соответствие типу
// const _validate: MakeAllFieldsRequired<ValueTypes['CommonRequestResponse']>
//   = rawCommonRequestSelector

// // Передаём raw в селектор
// export const generateCommonRequestResponseSelector = Selector('CommonRequestResponse')(rawCommonRequestSelector)
