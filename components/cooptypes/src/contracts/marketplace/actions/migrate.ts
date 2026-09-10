import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Перенос открытых обязательств перед поставщиками на кошелёк к оплате
 * `w.mkt.topay` (задача 99D-16): по каждому поставщику начисляется только
 * недостающая сумма, повторный запуск ничего не удваивает. Обходит все
 * кооперативы; подписывает сам контракт marketplace при его установке.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'migrate'

/**
 * @interface
 */
export type IMigrate = Marketplace.IMigrate
