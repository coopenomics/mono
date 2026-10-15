import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Оператор участка выдачи отмечает поступление имущества на свой участок (paevaya модель): acceptcoop → readyrecv, без подписи и документов. Заменяет прежний signiss1.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'readyissue'

/**
 * @interface
 */
export type IReadyIssue = Marketplace.IReadyIssue
