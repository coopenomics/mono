import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { ContractNames } from '../../../common'

/**
 * Председатель подписал приложение к договору — коллбэк контракта совета.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

export const actionName = 'apprvannex'

/**
 * @interface
 */
export type IApprvannex = Edubridge.IApprvannex
