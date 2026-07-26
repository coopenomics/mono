import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Селектор для логов капитала
const rawLogSelector = {
  _id: true,
  coopname: true,
  project_hash: true,
  entity_type: true,
  entity_id: true,
  event_type: true,
  initiator: true,
  actor_name: true,
  title: true,
  description: true,
  reference_id: true,
  metadata: true,
  message: true,
  created_at: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalLog']> = rawLogSelector

export type logModel = ModelTypes['CapitalLog']

export const logSelector = Selector('CapitalLog')(rawLogSelector)
export { rawLogSelector }
