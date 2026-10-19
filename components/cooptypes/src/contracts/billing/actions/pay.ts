import * as Permissions from '../../../common/permissions'
import type * as Billing from '../../../interfaces/billing'
import { Actors } from '../../../common'

/**
 * Требуется авторизация {@link Actors._coopname | аккаунта кооператива}
 * (списание инициирует оператор от имени кооператива).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'pay'

/**
 * @interface
 */
export type IPay = Billing.IPay
