import * as Actors from '../../../common/actors'
import type * as Branch from '../../../interfaces/branch'

/**
 * Имя таблицы
 */
export const tableName = 'reserves'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Резерв социально-экономического обеспечения пайщиков участка: строка на
 * пару участок + получатель, сумма материальной помощи в месяц (задача 99D-20).
 */
export type IBranchReserve = Branch.IBranchReserve
