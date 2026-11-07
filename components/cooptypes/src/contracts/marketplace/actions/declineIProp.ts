import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Отказ председателя участка по заявлению на имущество до передачи в совет. Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'declineiprop'

/**
 * @interface
 */
export type IDeclineIProp = Marketplace.IDeclineIProp
