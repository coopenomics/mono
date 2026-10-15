import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Закрытие окна расчёта по занятию: подписки группы рассчитаны (процесс p.edu.rid).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'closecharge'

/**
 * @interface
 */
export type IClosecharge = Edubridge.IClosecharge
