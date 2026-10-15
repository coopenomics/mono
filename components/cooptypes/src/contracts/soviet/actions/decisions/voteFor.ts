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
export const actionName = 'votefor'

/**
 * @interface
 * Принимает голос «ЗА» от члена совета по решению на повестке. Хэш подписи привязан к голосу
 * (Classes.Vote.buildVoteDigest), ключ подписи принадлежит указанному разрешению аккаунта:
 * active — ручной голос, иное разрешение — голос робота по включённой автоматизации.
 */
export type IVoteForDecision = Soviet.IVotefor
