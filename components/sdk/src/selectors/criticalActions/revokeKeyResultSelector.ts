import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawRevokeKeyResultSelector = {
  status: true,
  target_id: true,
  sessions_revoked: true,
  must_recover: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['RevokeKeyResult']> = rawRevokeKeyResultSelector

export const revokeKeyResultSelector = Selector('RevokeKeyResult')(rawRevokeKeyResultSelector)
