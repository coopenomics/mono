import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Отмена выдачи займа до выплаты.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'cancelloan'

/**
 * @interface
 */
export type ICancelLoan = Debt.ICancelloan
