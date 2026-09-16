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
 * Действие утверждения принятого советом решения протоколом с подписью председателя.
 * Ключ подписи председателя принадлежит указанному разрешению его аккаунта: active — ручная
 * подпись, иное разрешение — подпись робота по включённой автоматизации протоколов этого типа.
 */
export type IAuthorize = Soviet.IAuthorize
