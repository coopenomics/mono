import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Выделение доли собранного взноса в резерв выплат преподавателям (процесс
 * p.edu.access): в фонде программы остаются свободные средства.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'allotfee'

/**
 * @interface
 */
export type IAllotfee = Edubridge.IAllotfee
