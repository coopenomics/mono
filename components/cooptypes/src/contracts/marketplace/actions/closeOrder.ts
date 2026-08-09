import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Backend по расписанию закрывает выданный заказ после выхода гарантийного
 * срока (p.mkt.supply): запись заказа стирается из RAM (терминал жизненного
 * цикла), история — в журнале действий. Контракт отклоняет закрытие до
 * выхода гарантийного срока, при незавершённой выплате поставщику или
 * открытом гарантийном возврате.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'closeorder'

/**
 * @interface
 */
export type ICloseOrder = Marketplace.ICloseOrder
