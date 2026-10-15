import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Перевод паевого взноса во внутренний членский кошелёк «Стола заказов» по
 * заявлению 1110 — отдельная транзакция до заказа, только когда членского
 * кошелька программы не хватает. По кошелькам двигается лишь членская часть
 * (o.mkt.conv с Цифрового кошелька), разбитая по заказам: на каждый заказ
 * эмитится своя операция с `process_hash = order_hash`, поэтому перевод виден
 * первым шагом нитки того заказа, который оплачивает. Заявление публикуется в
 * реестр документов отдельным пакетом — оно одно на всё оформление.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'convert'

/**
 * @interface
 */
export type IConvert = Marketplace.IConvert
