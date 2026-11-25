import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Взнос преподавателя не принят (процесс p.edu.rid): материалы снимаются с
 * ответственного хранения и возвращаются ему на доработку — o.edu.retrid.
 * Один путь для отказа совета, истёкшего срока вопроса и отказа председателя
 * в подписи акта. Запись материалов остаётся и ждёт повторной передачи;
 * подписки участников не затрагиваются.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'returnrid'

/**
 * @interface
 */
export type IReturnrid = Edubridge.IReturnrid
