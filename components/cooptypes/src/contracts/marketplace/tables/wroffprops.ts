import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'wroffprops'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Проекты решений совета о списании скоропорта — анкеры процесса p.mkt.wroff.
 */
export type IWriteoffProposal = Marketplace.IWriteoffProposal
