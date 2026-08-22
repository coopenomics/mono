import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback контракта soviet — совет одобрил выплату материальной помощи
 * (requirement b6): заявление переходит в authorized, протокол сохраняется,
 * и регистрируется исходящий платёж в gateway — заявка попадает к кассиру.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'onaidauth'

/**
 * @interface
 */
export type IOnaidauth = Branch.IOnaidauth
