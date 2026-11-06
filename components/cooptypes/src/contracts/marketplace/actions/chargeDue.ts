import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Списание обеспечительной части паевого взноса в членский взнос кооперативного
 * участка по условиям ЦПП «Стол заказов» (задача 99D-18): o.mkt.charge
 * (w.mkt.due → w.mkt.fee) и o.brn.common (w.mkt.fee → w.brn.common, Дт 80 / Кт 86).
 * Когда и сколько, называет бэкенд по своему учёту заказов; контракт держит
 * потолок остатка кошелька к списанию. require_auth(coopname).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'chargedue'

/**
 * @interface
 */
export type IChargeDue = Marketplace.IChargeDue
