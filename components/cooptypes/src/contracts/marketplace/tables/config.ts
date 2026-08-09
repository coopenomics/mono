import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'config'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Singleton-конфигурация «Стола заказов»: единая ставка членского взноса кооператива.
 */
export type IMktConfig = Marketplace.IMktConfig
