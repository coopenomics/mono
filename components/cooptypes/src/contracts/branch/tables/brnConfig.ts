import * as Actors from '../../../common/actors'
import type * as Branch from '../../../interfaces/branch'

/**
 * Имя таблицы
 */
export const tableName = 'brnconfig'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Настройки экономики участков: потолок резерва социально-экономического
 * обеспечения на получателя в месяц (задача 99D-20). Синглтон.
 */
export type IBranchConfig = Branch.IBrnconfig
