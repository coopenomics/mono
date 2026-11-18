import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — подпись доверенности председателем кооперативного участка (после решения совета об учреждении участка)
 */
export const actionName = 'signauth'

/**
 * @interface
 */
export type ISignAuth = Branch.ISignauth
