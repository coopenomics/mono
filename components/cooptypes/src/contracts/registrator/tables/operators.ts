import type * as Registrator from '../../../interfaces/registrator'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'operators'

/**
 * Таблица хранится в {@link ContractNames._registrator | области памяти контракта}.
 */
export const scope = ContractNames._registrator

/**
 * @interface
 * Операторы сети — кооперативы, которых ведущий назначил подключать другие
 * кооперативы и обслуживать их.
 */
export type INetworkOperator = Registrator.INetworkOperator
