import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawCurrentInstanceSelector = {
  status: true,
  is_valid: true,
  is_delegated: true,
  blockchain_status: true,
  progress: true,
  domain: true,
  title: true,
  description: true,
  image: true,
  maintenance_mode: true,
  is_restoring: true,
  is_released: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CurrentInstanceDTO']> = rawCurrentInstanceSelector

export const currentInstanceSelector = Selector('CurrentInstanceDTO')(rawCurrentInstanceSelector)
