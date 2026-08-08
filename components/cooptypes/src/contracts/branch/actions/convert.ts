import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Перевод персональных средств доверенного в членский кошелёк «Стола заказов»
 * (o.brn.conv) — для заказов как обычный пайщик.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'convert'

/**
 * @interface
 */
export type IConvert = Branch.IConvert
