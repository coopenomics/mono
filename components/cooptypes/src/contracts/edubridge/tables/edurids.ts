import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'edurids'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Заявления о взносе РИД в ожидании решения совета — анкеры процесса p.edu.rid.
 */
export type IEduRid = Edubridge.IEduRid
