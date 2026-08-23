import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — отклонение доверенности председателя участка (заблокировано)
 */
export const actionName = 'declauth'

/**
 * @interface
 */
export type IDeclAuth = Branch.IDeclauth
