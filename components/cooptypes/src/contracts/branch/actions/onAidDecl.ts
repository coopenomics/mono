import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback контракта soviet — совет отказал в выплате материальной помощи
 * либо срок рассмотрения истёк (requirement b6). Заявление закрывается, не
 * доходя до кассира; средства остаются на персональном кошельке получателя.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'onaiddecl'

/**
 * @interface
 */
export type IOnaiddecl = Branch.IOnaiddecl
