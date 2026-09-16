import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { ContractNames } from '../../../common'

/**
 * Председатель отказал в подписи приложения — коллбэк контракта совета.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

export const actionName = 'dclineannex'

/**
 * @interface
 */
export type IDclineannex = Edubridge.IDclineannex
