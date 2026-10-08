import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'eduassigns'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Допуск преподавателя к курсу и его ставка.
 */
export type IEduAssignment = Edubridge.IEduAssignment
