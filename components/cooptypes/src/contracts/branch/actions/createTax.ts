import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Отправить удержанный НДФЛ на оплату в бюджет (requirement b6, решение
 * владельца 2026-08-13): бухгалтер отправляет накопленное → gateway::createoutpay
 * → списание o.brn.taxpay в taxconfirm. Сумма не больше остатка w.brn.ndfl.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'createtax'

/**
 * @interface
 */
export type ICreatetax = Branch.ICreatetax
