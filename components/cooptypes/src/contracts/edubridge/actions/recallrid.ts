import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Снятие материалов занятия с ответственного хранения по подтверждённой
 * рекламации внутри гарантийного срока (процесс p.edu.rid). Материалы
 * возвращаются преподавателю, паевой взнос по ним не оформляется.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'recallrid'

/**
 * @interface
 */
export type IRecallrid = Edubridge.IRecallrid
