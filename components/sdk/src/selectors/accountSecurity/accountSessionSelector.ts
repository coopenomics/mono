import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawAccountSessionSelector = {
  id: true,
  device: true,
  ip: true,
  created_at: true,
  last_seen_at: true,
  current: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['AccountSession']> = rawAccountSessionSelector

export const accountSessionSelector = Selector('AccountSession')(rawAccountSessionSelector)
