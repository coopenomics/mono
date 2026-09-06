import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Пайщик выводит свободный паевой «Стола заказов» в общий паевой Цифрового кошелька (o.mkt.recall, без документа).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'recallshare'

/**
 * @interface
 */
export type IRecallShare = Marketplace.IRecallShare
