import type * as Registrator from '../../../interfaces/registrator'
import { Actors } from '../../../common'

/**
 * Имя таблицы
 */
export const tableName = 'exits'

/**
 * Таблица хранится в области памяти {@link Actors._coopname | кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Реестр заявлений пайщиков на выход из кооператива и сопровождающих их
 * процессов возврата паевого взноса.
 */
export type IExit = Registrator.IExit
