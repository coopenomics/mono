import * as Permissions from '../../../../common/permissions'
import type * as Soviet from '../../../../interfaces/soviet'
import { Actors } from '../../../../common'

/**
 * Действие выполняется за подписью {@link Actors._coopname | кооператива} (проводится через бэкенд).
 * Председатель явно отклоняет решение, против которого проголосовало большинство состава совета.
 */
export const authorizations = [
  { permissions: [Permissions.active], actor: Actors._coopname },
] as const

/**
 * Имя действия
 */
export const actionName = 'declinedec'

/**
 * @interface
 * Явное отклонение решения советом по отрицательному консенсусу (до истечения срока).
 */
export type IDeclineDecision = Soviet.IDeclinedec
