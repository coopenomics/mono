import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Отчёт преподавателя о занятии (процесс p.edu.rid): открывает расчёт с участниками.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'openlesson'

/**
 * @interface
 */
export type IOpenlesson = Edubridge.IOpenlesson
