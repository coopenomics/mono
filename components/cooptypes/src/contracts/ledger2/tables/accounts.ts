import type * as Ledger2 from '../../../interfaces/ledger2'
import { Actors } from '../../../common'

/**
 * Имя таблицы
 */
export const tableName = 'accounts'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Таблица содержит бухгалтерские счета ledger2 по плану счетов кооператива
 * (двойная запись: debit_balance / credit_balance / balance).
 */
export type IAccount = Ledger2.IAccount2
