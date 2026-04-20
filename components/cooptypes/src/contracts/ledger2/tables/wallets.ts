import type * as Ledger2 from '../../../interfaces/ledger2'
import { Actors } from '../../../common'

/**
 * Имя таблицы
 */
export const tableName = 'wallets'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Таблица содержит аналитические кошельки ledger2 (разрезы бухсчетов по
 * программам/операциям).
 */
export type IWallet = Ledger2.IWallet2
