import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'invbranches'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Вложения инициаторов кооперативного участка и счётчик возврата (CRPS); первичный ключ — участок. Задача 99D-27.
 */
export type IMktInvBranch = Marketplace.IMktInvBranch
