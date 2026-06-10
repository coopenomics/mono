import * as Actors from '../../../common/actors'
import type * as Branch from '../../../interfaces/branch'

/**
 * Имя таблицы
 */
export const tableName = 'weights'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Реестр весов распределения членских взносов КУ per (участок, контракт-источник).
 */
export type IBranchWeight = Branch.IBranchWeight
