import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Стереть строку прогона участка (задача 99D-21): позапрошлый месяц, когда у
 * участка уже есть строки текущего и предыдущего прогона. Зовёт ИСТОК.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'delperiod'

/**
 * @interface
 */
export type IDelPeriod = Marketplace.IDelPeriod
