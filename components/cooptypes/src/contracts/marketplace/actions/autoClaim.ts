import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Кооператив признаёт претензию за поставщика по истечении срока ответа — только при включённом автоприёме в настройках Стола заказов.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'autoclaim'

/**
 * @interface
 */
export type IAutoClaim = Marketplace.IAutoClaim
