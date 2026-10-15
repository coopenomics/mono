import type * as Ano from '../../../interfaces/ano'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'repschemas'

/**
 * Таблица хранится в {@link ContractNames._ano | области памяти контракта}.
 */
export const scope = ContractNames._ano

/**
 * @interface
 * Версии единой схемы весов репутации: полный JSON каждой версии с датой
 * публикации. Действующая — запись с наибольшим номером.
 */
export type IRepSchema = Ano.IRepSchema
