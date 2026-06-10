import * as Actors from '../../../common/actors'
import type * as Branch from '../../../interfaces/branch'

/**
 * Имя таблицы
 */
export const tableName = 'rounds'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Раунды ручного распределения средств общего кошелька КУ (история команд председателя).
 */
export type IBranchRound = Branch.IBranchRound
