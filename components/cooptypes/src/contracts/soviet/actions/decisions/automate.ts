import * as Permissions from '../../../../common/permissions'
import type * as Soviet from '../../../../interfaces/soviet'
import { Actors } from '../../../../common'

/**
 * Действие выполняется за подписью {@link Actors._member | члена совета}.
 */
export const authorizations = [
  { permissions: [Permissions.active], actor: Actors._member },
] as const

/**
 * Имя действия
 */
export const actionName = 'automate'

/**
 * @interface
 * Включает или изменяет автоматизацию решений совета для члена совета: имя отдельного разрешения
 * аккаунта с ключом робота, типы решений для автоматического голосования и (для председателя)
 * типы решений, протоколы которых робот подписывает. Одна запись на члена совета, повторный вызов заменяет настройки.
 */
export type IAutomate = Soviet.IAutomate
