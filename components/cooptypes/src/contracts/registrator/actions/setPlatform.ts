import * as Permissions from '../../../common/permissions'
import type * as Registrator from '../../../interfaces/registrator'
import { Actors } from '../../../common'

/**
 * Подписывает сам аккаунт своим активным полномочием либо кооператив, в
 * котором аккаунт — действующий пайщик.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }, { permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'setplatform'

/**
 * Имя разрешения узла кооператива на цепи.
 */
export const permissionName = 'platform'

/**
 * @interface
 * Выпуск разрешения `platform` — ключа, которым узел кооператива подписывает
 * транзакции от имени аккаунта; смену ключа пайщика при восстановлении доступа
 * разрешение переживает.
 */
export type ISetPlatform = Registrator.ISetplatform
