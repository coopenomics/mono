import * as Permissions from '../../../../common/permissions'
import type * as Soviet from '../../../../interfaces/soviet'
import { Actors } from '../../../../common'

/**
 * Отправить удержанный НДФЛ на оплату в бюджет (решение владельца
 * 2026-08-13): бухгалтер отправляет накопленное → gateway::createoutpay →
 * списание o.sov.taxpay в taxconfirm. Сумма не больше остатка w.sov.ndfl.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'createtax'

/**
 * @interface
 */
export type ICreatetax = Soviet.ICreatetax
