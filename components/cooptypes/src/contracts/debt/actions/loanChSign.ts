import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Председатель подписал договор залога и акт передачи права в залог (той же транзакцией, что договор займа).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'loanchsign'

/**
 * @interface
 */
export type ILoanChSign = Debt.ILoanchsign
