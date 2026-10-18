import type * as Registrator from '../../../interfaces/registrator'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'platforms'

/**
 * Таблица хранится в {@link ContractNames._registrator | области памяти контракта}.
 */
export const scope = ContractNames._registrator

/**
 * @interface
 * Выпущенные разрешения `platform` — ключи узлов кооперативов.
 */
export type IPlatform = Registrator.IPlatform
