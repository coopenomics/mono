import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'kucounters'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Счётчик участка за период списания (задача 99D-33): стоимость заказов и
 * собранная обеспечительная часть, по которым `closeperiod` считает ставки.
 * Строка на (участок, период); стирается расчётом итога. Индексы: bybranch (2),
 * bybrperiod (3).
 */
export type IKuCounter = Marketplace.IKuCounter
