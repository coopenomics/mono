import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Перевод паевого взноса во внутренний членский кошелёк «Стола заказов» по
 * заявлению 1110 — отдельная транзакция до заказа, только когда членского
 * кошелька не хватает. По кошелькам двигается лишь членская часть
 * (o.mkt.conv с Цифрового кошелька либо o.mkt.convp со свободного паевого
 * программы); заявление публикуется в реестр документов отдельным пакетом.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'convert'

/**
 * @interface
 */
export type IConvert = Marketplace.IConvert
