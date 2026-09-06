import type * as Soviet from '../../../interfaces/soviet'
import { Actors } from '../../../common'

/**
 * Имя таблицы
 */
export const tableName = 'automator'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Реестр автоматизаций робота решений совета: одна запись на члена совета с именем разрешения
 * аккаунта, ключом которого подписывает робот, и списками типов решений для голосования и протоколов.
 * Приватных ключей в цепи нет.
 */
export type IAutomations = Soviet.IAutomator
