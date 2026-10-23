import * as Permissions from '../../../common/permissions'
import type * as Billing from '../../../interfaces/billing'
import { Actors } from '../../../common'

/**
 * Требуется авторизация {@link Actors._contract | аккаунта контракта billing}.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'migrate'

/**
 * @interface
 */
export type IMigrate = Billing.IMigrate
