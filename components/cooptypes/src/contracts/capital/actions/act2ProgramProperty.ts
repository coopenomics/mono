import * as Permissions from '../../../common/permissions'
import type * as Capital from '../../../interfaces/capital'
import { ContractNames } from '../../../common'

/**
 * Председатель подписал акт приёма-передачи имущества вторым — коллбэк контракта
 * совета после подтверждения одобрения: имущество принимается паевым взносом в
 * программу «Благорост» (процесс p.cap.prop).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

/**
 * Имя действия
 */
export const actionName = 'act2pgprp'

/**
 * @interface
 */
export type IAct2ProgramProperty = Capital.IAct2pgprp
