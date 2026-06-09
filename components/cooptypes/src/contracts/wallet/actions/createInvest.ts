import * as Permissions from '../../../common/permissions'
import type * as Wallet from '../../../interfaces/wallet'
import { Actors } from '../../../common'

/**
 * Имя действия
 * Требуется авторизация {@link Actors._coopname | кооператива}.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'createinv'

/**
 * @interface
 * Действие для создания заявки кооператива на инвестирование собственных средств в ЦПП оператора платформы.
 */
export type ICreateInvest = Wallet.ICreateinv
