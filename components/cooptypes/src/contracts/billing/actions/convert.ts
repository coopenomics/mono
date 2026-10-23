import * as Permissions from '../../../common/permissions'
import type * as Billing from '../../../interfaces/billing'
import { Actors } from '../../../common'

/**
 * Требуется авторизация {@link Actors._coopname | аккаунта кооператива}
 * (бэкенд ретранслирует после JWT; согласие пайщика несёт `document`).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'convert'

/**
 * @interface
 */
export type IConvert = Billing.IConvert
