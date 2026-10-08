import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Расчёт за занятие по одной подписке (процесс p.edu.rid): оплата занятия уходит из резерва
 * подписки во взнос преподавателя.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'chargelesson'

/**
 * @interface
 */
export type IChargelesson = Edubridge.IChargelesson
