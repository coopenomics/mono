import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { ContractNames } from '../../../common'

/**
 * Председатель подписал акт приёма-передачи РИД — коллбэк контракта совета после
 * подтверждения одобрения: результат принимается в паевой фонд (процесс p.edu.rid).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

export const actionName = 'apprvridact'

/**
 * @interface
 */
export type IApprvRidAct = Edubridge.IApprvRidAct
