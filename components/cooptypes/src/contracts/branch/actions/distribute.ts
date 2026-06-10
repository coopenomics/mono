import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Ручное распределение средств общего кошелька КУ председателем (раунд 5 requirement b6):
 * сумма раскладывается по весам через двухходовку o.brn.release + o.brn.person; остаток
 * округления остаётся в общем кошельке. Плановый резерв 30 дней контролирует бэкенд.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'distribute'

/**
 * @interface
 */
export type IDistribute = Branch.IDistribute
