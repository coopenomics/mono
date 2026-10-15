import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Условия курса (процесс p.edu.access): плановая ставка за час на одного участника, целевой
 * членский взнос, расписание, скидка, гарантийный срок. По ним контракт считает все суммы.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'setcourse'

/**
 * @interface
 */
export type ISetcourse = Edubridge.ISetcourse
