import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'invagreemnts'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Договоры участия в хозяйственной деятельности по ЦПП «Стол заказов»: один на пайщика. Задача 99D-27.
 */
export type IMktInvAgreement = Marketplace.IMktInvAgreement
