import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawCriticalActionConfirmationSelector } from './criticalActionConfirmationSelector'

export const rawCriticalActionAuditEntrySelector = {
  id: true,
  action_type: true,
  target_id: true,
  status: true,
  created_at: true,
  finalized_at: true,
  initiator_id: true,
  initiated_at: true,
  confirmer_ids: rawCriticalActionConfirmationSelector,
  payload_hash: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CriticalActionAuditEntry']> = rawCriticalActionAuditEntrySelector

export const criticalActionAuditEntrySelector = Selector('CriticalActionAuditEntry')(rawCriticalActionAuditEntrySelector)
