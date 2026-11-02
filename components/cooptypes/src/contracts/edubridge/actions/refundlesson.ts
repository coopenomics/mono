import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Отказ совета по взносу результатом занятия (процесс p.edu.rid): оплата
 * занятия возвращается в подписки учеников, где оно рассчитано, номер занятия
 * освобождается. Повторный отчёт идёт обычным расчётом — ученики платят за
 * занятие один раз.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'refundlesson'

/**
 * @interface
 */
export type IRefundlesson = Edubridge.IRefundlesson
