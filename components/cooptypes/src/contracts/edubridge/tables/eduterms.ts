import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'eduterms'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Условия курса: ставка, взнос, расписание, скидка, гарантийный срок.
 */
export type IEduTerms = Edubridge.IEduTerms
