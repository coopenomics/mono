import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'edusubs'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Активные подписки на курсы — анкеры процесса p.edu.access.
 */
export type IEduSubscription = Edubridge.IEduSubscription
