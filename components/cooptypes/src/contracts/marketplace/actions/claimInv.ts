import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Трансляция возвращённого вложения в главный паевой по заявлению 1123 (o.mkt.iback); сумму считает контракт. Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'claiminv'

/**
 * @interface
 */
export type IClaimInv = Marketplace.IClaimInv
