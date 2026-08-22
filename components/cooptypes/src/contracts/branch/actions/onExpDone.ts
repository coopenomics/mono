import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback шасси расходов — расход участка завершён (отклонён советом либо
 * закрыт после отчёта). Неизрасходованный остаток возвращается в общий
 * кошелёк участка (o.brn.expunf), запись расхода стирается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'onexpdone'

/**
 * @interface
 */
export type IOnexpdone = Branch.IOnexpdone
