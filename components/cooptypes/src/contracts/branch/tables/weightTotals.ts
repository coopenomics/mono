import * as Actors from '../../../common/actors'
import type * as Branch from '../../../interfaces/branch'

/**
 * Имя таблицы
 */
export const tableName = 'weighttotals'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Агрегат Σ весов распределения по (участок, контракт-источник).
 */
export type IBranchWeightTotal = Branch.IBranchWeightTotal
