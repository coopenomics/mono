import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { ContractNames } from '../../../common'

/**
 * Председатель подписал договор УХД — коллбэк контракта совета после подтверждения одобрения.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

export const actionName = 'apprvcontr'

/**
 * @interface
 */
export type IApprvcontr = Edubridge.IApprvcontr
