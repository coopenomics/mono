import * as Permissions from '../../../common/permissions'
import * as ContractNames from '../../../common/names'
import type * as Registrator from '../../../interfaces/registrator'

/**
 * Требуется авторизация совета: отказ в приёме кандидата.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

/**
 * Имя действия
 */
export const actionName = 'declinereg'

/**
 * @interface
 */
export type IDeclineRegistration = Registrator.IDeclinereg
