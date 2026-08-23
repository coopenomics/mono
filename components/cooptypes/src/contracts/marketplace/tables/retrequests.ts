import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'retrequests'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Заявления на гарантийный возврат — анкеры процесса p.mkt.return.
 */
export type IReturnRequest = Marketplace.IReturnRequest
