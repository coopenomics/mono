import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Снять резерв социально-экономического обеспечения получателя на участке
 * (задача 99D-20). Роль председателя участка проверяет ИСТОК.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'delreserve'

/**
 * @interface
 */
export type IDelreserve = Branch.IDelreserve
