import * as Actors from '../../../common/actors'
import type * as Branch from '../../../interfaces/branch'

/**
 * Имя таблицы
 */
export const tableName = 'taxes'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Заявки на перечисление удержанного НДФЛ в бюджет: живут от отправки
 * бухгалтером до подтверждения кассиром.
 */
export type IBranchTax = Branch.IBranchTax
