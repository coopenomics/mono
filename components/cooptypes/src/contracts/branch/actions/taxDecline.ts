import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback gateway::outdecline — кассир не смог перечислить налог. Заявка
 * закрывается, обязательство перед бюджетом остаётся в полном объёме.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'taxdecline'

/**
 * @interface
 */
export type ITaxdecline = Branch.ITaxdecline
