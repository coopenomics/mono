import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Возврат членского взноса из общего кошелька КУ в пул взносов программы
 * (o.brn.retfee) — инверсия accrue. Вызывается inline контрактом-источником
 * (marketplace::accretrn) при приёме гарантийного возврата, чтобы пайщику
 * вернулась полная уплаченная сумма, а не только стоимость имущества.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'retfee'

/**
 * @interface
 */
export type IRetfee = Branch.IRetfee
