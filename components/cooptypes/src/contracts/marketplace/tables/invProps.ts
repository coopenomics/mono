import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'invprops'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Заявления инициаторов о паевом взносе имуществом в участок до второй подписи акта; индексы byhash (2), bybranch (3), byuser (4). Задача 99D-27.
 */
export type IMktInvProp = Marketplace.IMktInvProp
