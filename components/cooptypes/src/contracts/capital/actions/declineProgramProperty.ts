import * as Permissions from '../../../common/permissions'
import type * as Capital from '../../../interfaces/capital'
import { ContractNames } from '../../../common'

/**
 * Паевой взнос имуществом отклонён — коллбэк контракта совета: председатель
 * отказал в одобрении заявления или подписи акта, либо совет отклонил приём
 * (процесс p.cap.prop). Запись взноса удаляется.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

/**
 * Имя действия
 */
export const actionName = 'declinepgprp'

/**
 * @interface
 */
export type IDeclineProgramProperty = Capital.IDeclinepgprp
