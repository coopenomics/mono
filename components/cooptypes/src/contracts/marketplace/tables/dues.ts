import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'kudues'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Счётчик пайщика за период списания (задача 99D-33): стоимость выданных
 * заказов, обеспечительная часть к списанию по ставкам и удержания при отказе.
 * Строка на (пайщик, участок, период); списывается одной транзакцией
 * `chargeperiod` и стирается. Индексы: byuser (2), bybranch (3), bybrperiod (4).
 */
export type IKuDue = Marketplace.IKuDue
