import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Преподаватель передаёт материалы проведённого занятия кооперативу на
 * ответственное хранение (процесс p.edu.rid). Материалы числятся за ним весь
 * гарантийный срок курса; паевым взносом они становятся по заявлению и
 * решению совета.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'holdrid'

/**
 * @interface
 */
export type IHoldrid = Edubridge.IHoldrid
