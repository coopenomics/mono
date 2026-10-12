import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Пайщик подписал акт передачи права в залог: сумма начислена к выдаче, платёж передан кассиру.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'loanactsign'

/**
 * @interface
 */
export type ILoanActSign = Debt.ILoanactsign
