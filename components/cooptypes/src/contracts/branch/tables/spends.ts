import * as Actors from '../../../common/actors'
import type * as Branch from '../../../interfaces/branch'

/**
 * Имя таблицы
 */
export const tableName = 'spends'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Команды оплаты расходов КУ из общего кошелька (pending/completed/declined).
 */
export type IBranchSpend = Branch.IBranchSpend
