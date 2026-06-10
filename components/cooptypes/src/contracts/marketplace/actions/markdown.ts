import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Списание уценки по заказу из остатка кооператива (requirement 76, вопрос 4).
 * o.mkt.loss (NONE, Дт 91 / Кт 10): разница цены прибытия и фактической суммы
 * выдачи выбывает со склада в прочие расходы. Вместе с o.mkt.consum — выбытие
 * по полной стоимости прибытия. Вызывает backend после финализации выдачи.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'markdown'

/**
 * @interface
 */
export type IMarkdown = Marketplace.IMarkdown
