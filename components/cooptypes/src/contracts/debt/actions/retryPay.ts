import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Повторная отправка платежа тем же решением совета.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'retrypay'

/**
 * @interface
 */
export type IRetryPay = Debt.IRetrypay
