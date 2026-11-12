import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'invagrbranch'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Договоры об участии в хозяйственной деятельности кооперативных участков: один на пару «пайщик — участок». Задачи 99D-27, 99D-35.
 */
export type IMktInvAgreement = Marketplace.IMktInvAgreement
