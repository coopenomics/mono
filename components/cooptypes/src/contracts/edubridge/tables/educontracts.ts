import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'educontracts'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Договоры УХД преподавателей — анкеры процесса p.edu.teach (pending → active).
 */
export type IEduContract = Edubridge.IEduContract
