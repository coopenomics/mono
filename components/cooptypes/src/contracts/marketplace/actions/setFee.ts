import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Единая ставка обеспечительной части паевого взноса «Стола заказов»: один процент
 * на весь кооператив (HUNDR_PERCENTS = 100%), задаёт администратор. Применяется к
 * новым заказам. Имя поля `membership_fee_percent` — историческое (задача 99D-18).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'setfee'

/**
 * @interface
 */
export type ISetFee = Marketplace.ISetFee
