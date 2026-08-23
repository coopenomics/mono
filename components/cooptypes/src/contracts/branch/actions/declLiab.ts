import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — отклонение договора материальной ответственности председателя участка (заблокировано)
 */
export const actionName = 'declliab'

/**
 * @interface
 */
export type IDeclLiab = Branch.IDeclliab
