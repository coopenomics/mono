import type * as Apps from '../../../interfaces/apps'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'subs'

/**
 * Таблица хранится в {@link ContractNames._apps | области памяти контракта}.
 */
export const scope = ContractNames._apps

/**
 * @interface
 * Подписки кооперативов на пакеты в конкретных подсетях.
 */
export type ISub = Apps.ISub
