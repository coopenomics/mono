import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — объявить собрание пайщиков
 */
export const actionName = 'createdec'

/**
 * @interface
 */
export type ICreateDec = Branch.ICreatedec
