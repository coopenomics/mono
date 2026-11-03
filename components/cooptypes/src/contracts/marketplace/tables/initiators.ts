import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'initiators'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Инициатор кооперативного участка Стола заказов — получатель доли экономии
 * месяца (задача 99D-21). Без строки инициатором считается председатель участка.
 */
export type IMktInitiator = Marketplace.IMktInitiator
