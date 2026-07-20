import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — встречная подпись председателя совета на договоре материальной ответственности председателя участка
 */
export const actionName = 'apprliab'

/**
 * @interface
 */
export type IApprLiab = Branch.IApprliab
