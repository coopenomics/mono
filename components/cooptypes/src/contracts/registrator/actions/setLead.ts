import * as Permissions from '../../../common/permissions'
import type * as Registrator from '../../../interfaces/registrator'
import { ContractNames } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._system }] as const

/**
 * Имя действия
 */
export const actionName = 'setlead'

/**
 * @interface
 */
export type ISetLead = Registrator.ISetlead
