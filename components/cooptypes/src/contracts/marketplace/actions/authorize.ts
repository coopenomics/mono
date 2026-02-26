import * as Permissions from '../../../common/permissions'
import * as ContractNames from '../../../common/names'
import type * as Marketplace from '../../../interfaces/marketplace'

/**
 * Имя действия
 * Требуется авторизация {@link ContractNames._soviet | аккаунта контракта совета}.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

/**
 * Имя действия
 */
export const actionName = 'authorize'

/**
 * @interface
 */
export type IWauthorize = Marketplace.IWauthorize
