import * as Permissions from '../../../common/permissions'
import type * as Wallet from '../../../interfaces/wallet'
import { Actors } from '../../../common'

/**
 * Имя действия
 * Требуется авторизация {@link Actors._chairman | председателя} — авторизацию
 * выплаты по заявке на возврат паевого взноса выполняет совет.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

/**
 * Имя действия
 */
export const actionName = 'authwthd'

/**
 * @interface
 * Действие авторизации советом выплаты по заявке на возврат паевого взноса
 * из кошелька (переводит заявку в статус, видимый кассиру).
 */
export type IAuthWithdraw = Wallet.IAuthwthd
