import * as Actors from '../../../common/actors'
import type * as Branch from '../../../interfaces/branch'

/**
 * Имя таблицы
 */
export const tableName = 'aidmonths'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Материальная помощь получателя за текущий месяц по UTC — накопитель для
 * проверки предела по резерву (задача 99D-20). Истории нет.
 */
export type IBranchAidmonth = Branch.IBranchAidmonth
