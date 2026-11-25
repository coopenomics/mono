import * as Permissions from '../../../common/permissions'
import type * as Capital from '../../../interfaces/capital'
import { ContractNames } from '../../../common'

/**
 * Председатель одобрил заявление о паевом взносе имуществом — коллбэк контракта
 * совета после подтверждения одобрения: вопрос выносится в повестку совета
 * (процесс p.cap.prop). Ключ одобрения — хэш заявления.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

/**
 * Имя действия
 */
export const actionName = 'approvepgprp'

/**
 * @interface
 */
export type IApproveProgramProperty = Capital.IApprovepgprp
