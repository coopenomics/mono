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
export const actionName = 'disautomate'

/**
 * @interface
 * Отключает автоматизацию решений совета для члена совета: запись стирается из реестра, и робот
 * больше не может подписать ничего от его имени. Разрешение с аккаунта член совета удаляет отдельно.
 */
export type IDisautomate = Soviet.IDisautomate
