import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик отменяет заказ / отказывается от получения (Story 4.4, p.mkt.supply).
 * До акцепта поставщиком — полный возврат резерва и членского взноса; после
 * акцепта — удержание 50% в общий кошелёк участка. Отказ после приёмки при
 * незавершённой выплате поставщику переводит заказ в статус `refused`: запись
 * живёт до подтверждения выплаты кассиром и стирается им (задача 99D-14).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'cancelorder'

/**
 * @interface
 */
export type ICancelOrder = Marketplace.ICancelOrder
