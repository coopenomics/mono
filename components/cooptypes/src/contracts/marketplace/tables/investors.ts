import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'investors'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Инициаторы участков: одна строка на пару «участок — пайщик»; индексы bybranch (2), byuser (3), bybruser (4). Задача 99D-27.
 */
export type IMktInvestor = Marketplace.IMktInvestor
