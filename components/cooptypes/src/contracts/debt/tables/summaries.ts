import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Имя таблицы
 */
export const tableName = 'summaries'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Общий остаток долга пайщика по всем выданным займам.
 */
export type ISummary = Debt.ISummary
