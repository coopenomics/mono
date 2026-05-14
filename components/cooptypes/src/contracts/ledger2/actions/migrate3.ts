import * as Permissions from '../../../common/permissions'
import type * as Ledger2 from '../../../interfaces/ledger2'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'migrate3'

/**
 * @interface
 */
export type IMigrate3 = Ledger2.IMigrate3
