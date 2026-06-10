import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'branchsplits'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Отсечки персонального распределения членского взноса по кооперативным участкам.
 */
export type IBranchSplit = Marketplace.IBranchSplit
