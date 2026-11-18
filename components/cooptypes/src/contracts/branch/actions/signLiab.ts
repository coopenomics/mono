import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — подпись договора о полной материальной ответственности председателем кооперативного участка (после решения совета об учреждении участка)
 */
export const actionName = 'signliab'

/**
 * @interface
 */
export type ISignLiab = Branch.ISignliab
