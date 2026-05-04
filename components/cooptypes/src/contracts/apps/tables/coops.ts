import type * as Apps from '../../../interfaces/apps'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'coops'

/**
 * Таблица хранится в {@link ContractNames._apps | области памяти контракта}.
 */
export const scope = ContractNames._apps

/**
 * @interface
 * Кооперативы каталога: chain_id подсети + subnet-signing-key
 * (отдельный от eosio::active).
 */
export type ICoop = Apps.ICoop
