import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'educourses'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Учёт средств курса: собрано взносов, остаток резерва выплат преподавателям, выплачено преподавателям.
 */
export type IEduCourse = Edubridge.IEduCourse
