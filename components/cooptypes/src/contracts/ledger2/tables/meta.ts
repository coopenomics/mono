import type * as Ledger2 from '../../../interfaces/ledger2'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'meta'

/**
 * Таблица хранится в {@link ContractNames._ledger2 | области памяти контракта}
 * (служебные флаги миграции и глобальное состояние ledger2).
 */
export const scope = ContractNames._ledger2

/**
 * @interface
 * Служебная таблица ledger2: флаги миграции и глобальное состояние.
 */
export type IMeta = Ledger2.IMeta
