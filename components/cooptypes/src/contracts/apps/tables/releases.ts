import type * as Apps from '../../../interfaces/apps'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'releases'

/**
 * Таблица хранится в {@link ContractNames._apps | области памяти контракта}.
 */
export const scope = ContractNames._apps

/**
 * @interface
 * Релизы пакетов: текущие active + recent superseded (TTL 90 дней) + withdrawn (без TTL).
 */
export type IRelease = Apps.IRelease
