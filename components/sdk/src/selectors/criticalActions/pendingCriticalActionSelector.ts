import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawCriticalActionConfirmationSelector } from './criticalActionConfirmationSelector'

export const rawPendingCriticalActionSelector = {
  id: true,
  action_type: true,
  actor_id: true,
  target_id: true,
  payload: true,
  status: true,
  confirmations: rawCriticalActionConfirmationSelector,
  created_at: true,
  expires_at: true,
  finalized_at: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['PendingCriticalAction']> = rawPendingCriticalActionSelector

export const pendingCriticalActionSelector = Selector('PendingCriticalAction')(rawPendingCriticalActionSelector)
