import type * as Wallet from '../../../interfaces/wallet'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'investments'

/**
 * Таблица хранится в {@link ContractNames._wallet | области памяти контракта}.
 */
export const scope = ContractNames._wallet

/**
 * @interface
 * Таблица содержит заявки кооператива на инвестирование собственных средств в ЦПП оператора платформы.
 */
export type IInvestments = Wallet.IInvestment
