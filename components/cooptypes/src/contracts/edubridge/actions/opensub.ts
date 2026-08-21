import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Открытие подписки на курс после оплаты членским взносом (процесс p.edu.access).
 * period ∈ {month, year}; sub_hash уникален; paid_until > now.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'opensub'

/**
 * @interface
 */
export type IOpensub = Edubridge.IOpensub
