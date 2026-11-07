import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Одобрение заявления на имущество председателем участка; контракт ставит вопрос на повестку совета (mktiprop). Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'approveiprop'

/**
 * @interface
 */
export type IApproveIProp = Marketplace.IApproveIProp
