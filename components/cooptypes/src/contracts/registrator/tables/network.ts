import type * as Registrator from '../../../interfaces/registrator'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'network'

/**
 * Таблица хранится в {@link ContractNames._registrator | области памяти контракта}.
 */
export const scope = ContractNames._registrator

/**
 * @interface
 * Состояние сети, одна строка: ведущий — кооператив, который запустил цепь и
 * ведёт сеть. Строки нет — действует ведущий по умолчанию.
 */
export type INetworkState = Registrator.INetworkState

/** Ведущий сети для цепи, где строка `network` ещё не записана. */
export const defaultLead = 'voskhod'
