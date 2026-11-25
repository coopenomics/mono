import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Доля пайщиков в экономии месяца участка (задача 99D-35, решение владельца
 * 16.11.2026): первое деление экономии — эта доля возвращается пайщикам,
 * остальное делится дальше. По умолчанию 38,2 %. Отдельная настройка от доли
 * инициатора (`setshares`). Ставит администратор; применяется при расчёте
 * итога месяца, прошедшие итоги не пересчитываются.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'setretshare'

/**
 * @interface
 */
export type ISetRetShare = Marketplace.ISetRetShare
