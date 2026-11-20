import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказ отклонённого кассиром пакета возвращается в ожидание выплаты: pending → declined, причина отказа переносится в заказ. Последний заказ стирает пакет.
 * require_auth(coopname).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'releasepay'

/**
 * @interface
 */
export type IReleasepay = Marketplace.IReleasepay
