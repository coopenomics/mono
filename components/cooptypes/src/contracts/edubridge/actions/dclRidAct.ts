import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { ContractNames } from '../../../common'

/**
 * Председатель отказал в подписи акта приёма-передачи РИД — коллбэк контракта совета
 * (процесс p.edu.rid). Материалы остаются на ответственном хранении.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

export const actionName = 'dclridact'

/**
 * @interface
 */
export type IDclRidAct = Edubridge.IDclRidAct
