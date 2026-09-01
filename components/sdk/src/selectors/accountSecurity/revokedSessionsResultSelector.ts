import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawRevokedSessionsResultSelector = {
  revoked: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['RevokedSessionsResult']> = rawRevokedSessionsResultSelector

export const revokedSessionsResultSelector = Selector('RevokedSessionsResult')(rawRevokedSessionsResultSelector)
