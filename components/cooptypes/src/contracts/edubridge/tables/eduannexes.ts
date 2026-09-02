import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'eduannexes'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Приложения к договору на курс в ожидании подписи председателя.
 */
export type IEduAnnex = Edubridge.IEduAnnex
