import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Переходный перенос (задача 99D-33, п. 6): при первом старте после обновления
 * узел переносит незакрытые строки своего зеркала `marketplace_secure_due` в
 * счётчики списания цепи. Контракт держит потолок: сумма строк пайщика после
 * переноса не выше остатка его кошелька к списанию `w.mkt.due`. Снимается
 * следующим выпуском после переноса.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'migratedue'

/**
 * @interface
 */
export type IMigrateDue = Marketplace.IMigrateDue
