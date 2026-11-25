import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Расчёт по материалам закрывается без приёма (процесс p.edu.rid) — решением
 * кооператива, с основанием. Материалы на хранении снимаются (o.edu.retrid),
 * взнос преподавателя из резерва курса переходит на кошелёк программы
 * (o.edu.free). Паевой взнос не оформляется, запись материалов стирается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'recallrid'

/**
 * @interface
 */
export type IRecallrid = Edubridge.IRecallrid
