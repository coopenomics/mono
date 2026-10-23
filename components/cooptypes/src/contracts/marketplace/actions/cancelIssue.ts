import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Оператор участка отменяет начатую выдачу из issueauth / issueact1 обратно в readyrecv; документы снимаются, резерв не трогается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'cancelissue'

/**
 * @interface
 */
export type ICancelIssue = Marketplace.ICancelIssue
