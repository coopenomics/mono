import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Трансляция паевого взноса из ЦПП «Цифровой кошелёк» в ЦПП «Стол заказов» по
 * заявлению 1110 (задача 99D-18): o.mkt.conv w.wal.share → w.mkt.share, без
 * проводки. Сумма — недостающая на свободном паевом часть тела заказов и
 * обеспечительной части, разбитая по заказам: на каждый заказ эмитится своя
 * операция с `process_hash = order_hash`, поэтому трансляция видна первым шагом
 * нитки того заказа, который оплачивает. Заявление публикуется в реестр
 * документов отдельным пакетом — оно одно на всё оформление.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'convert'

/**
 * @interface
 */
export type IConvert = Marketplace.IConvert
