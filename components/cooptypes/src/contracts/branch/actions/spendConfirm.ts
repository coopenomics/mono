import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback от gateway::outcomplete — кассир подтвердил банковский перевод по расходу КУ.
 * Здесь применяется o.brn.spend (BURN w.brn.common, Дт 86 / Кт 51).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'spendconfirm'

/**
 * @interface
 */
export type ISpendconfirm = Branch.ISpendconfirm
