import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Отзыв отчёта о занятии до расчёта с участниками (процесс p.edu.rid).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'droplesson'

/**
 * @interface
 */
export type IDroplesson = Edubridge.IDroplesson
