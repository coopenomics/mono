import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Потолок резерва социально-экономического обеспечения на одного получателя в
 * месяц — один на все участки кооператива; ноль выключает резерв (задача 99D-20).
 * Ставит администратор.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'setaidlimit'

/**
 * @interface
 */
export type ISetaidlimit = Branch.ISetaidlimit
