import * as Permissions from '../../../../common/permissions'
import type * as Soviet from '../../../../interfaces/soviet'
import { Actors } from '../../../../common'

/**
 * Действие выполняется за подписью {@link Actors._coopname | кооператива} (проводится через бэкенд).
 * Согласие председателя подтверждается его личной подписью на документе утверждения.
 */
export const authorizations = [
  { permissions: [Permissions.active], actor: Actors._coopname },
] as const

/**
 * Имя действия
 */
export const actionName = 'authorize'

/**
 * @interface
 * Действие утверждения принятого советом решения.
 */
export type IAuthorize = Soviet.IAuthorize
