import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Отказ в приёме РИД по решению совета. Без ledger-движения; запись стирается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'declinerid'

/**
 * @interface
 */
export type IDeclinerid = Edubridge.IDeclinerid
