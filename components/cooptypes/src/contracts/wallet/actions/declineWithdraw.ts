import * as Permissions from '../../../common/permissions'
import type * as Wallet from '../../../interfaces/wallet'
import { Actors } from '../../../common'

/**
 * Имя действия
 * Требуется авторизация {@link Actors._chairman | председателя} — отказ в
 * выплате по заявке на возврат паевого взноса выполняет совет.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

/**
 * Имя действия
 */
export const actionName = 'declinewthd'

/**
 * @interface
 * Действие отказа советом в выплате по заявке на возврат паевого взноса
 * из кошелька (переводит заявку в статус «отклонено»).
 */
export type IDeclineWithdraw = Wallet.IDeclinewthd
