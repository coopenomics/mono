import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Заявление о продлении срока возврата; подтверждает председатель.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'extendloan'

/**
 * @interface
 */
export type IExtendLoan = Debt.IExtendloan
