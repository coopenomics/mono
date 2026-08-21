import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Приём РИД по решению совета и акту: o.edu.rid (ISSUE → w.wal.share, Дт 04 / Кт 80).
 * Запись заявления стирается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'acceptrid'

/**
 * @interface
 */
export type IAcceptrid = Edubridge.IAcceptrid
