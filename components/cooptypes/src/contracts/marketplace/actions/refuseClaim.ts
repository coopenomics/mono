import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Поставщик отказал по гарантийной претензии: сумма учитывается как отказанная — основание для иска (o.mkt.refuse).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'refuseclaim'

/**
 * @interface
 */
export type IRefuseClaim = Marketplace.IRefuseClaim
