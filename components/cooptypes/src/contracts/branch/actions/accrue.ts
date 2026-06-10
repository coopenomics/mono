import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Зачисление 100% членского взноса в общий кошелёк КУ при финализации заказа
 * (o.brn.common; раунд 5 requirement b6 — приоритет общего кошелька). Вызывается inline
 * контрактом-источником (marketplace::signiss2).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'accrue'

/**
 * @interface
 */
export type IAccrue = Branch.IAccrue
