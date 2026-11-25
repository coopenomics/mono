import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Доля инициатора участка в экономии месяца (задача 99D-21): остальное
 * возвращается пайщикам. По умолчанию 61,8 %. Ставит администратор;
 * применяется при расчёте прогона, прошедшие прогоны не пересчитываются.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'setshares'

/**
 * @interface
 */
export type ISetShares = Marketplace.ISetShares
