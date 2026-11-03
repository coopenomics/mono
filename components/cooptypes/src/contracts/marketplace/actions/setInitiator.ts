import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Инициатор кооперативного участка Стола заказов — получатель доли экономии
 * месяца (задача 99D-21). Без строки инициатором считается председатель
 * участка; пустое имя стирает строку. Ставит администратор.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'setinitiator'

/**
 * @interface
 */
export type ISetInitiator = Marketplace.ISetInitiator
