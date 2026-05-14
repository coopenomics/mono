import type * as Apps from '../../../interfaces/apps'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'packages'

/**
 * Таблица хранится в {@link ContractNames._apps | области памяти контракта}.
 */
export const scope = ContractNames._apps

/**
 * @interface
 * Реестр зарегистрированных пакетов каталога приложений.
 */
export type IPackage = Apps.IPackage
