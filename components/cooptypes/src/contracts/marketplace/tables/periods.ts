import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'kuperiods'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Итог прогона списания по участку (задача 99D-21): факты ИСТОКА, расчёт
 * контракта и ставки деления списания. У участка не больше двух строк —
 * текущий и предыдущий прогон; история — в базе ИСТОКА.
 */
export type IKuPeriod = Marketplace.IKuPeriod
