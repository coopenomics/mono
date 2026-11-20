import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — направить заявление в совет об учреждении участка (только заявление: доверенность и договор председатель участка подписывает после решения совета — signauth, signliab)
 */
export const actionName = 'exec'

/**
 * @interface
 */
export type IExec = Branch.IExec
