import type * as Capital from '../../../interfaces/capital'
import { Actors } from '../../../common'

/**
 * Имя таблицы
 */
export const tableName = 'rolerequests'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Таблица содержит заявки/инвайты на L2-допуски и обновление ставки (Благорост Эпик D).
 */
export type IRoleRequest = Capital.IRoleRequest
