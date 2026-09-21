import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Публикация Заявления о взносе, целиком покрытом кошельком программы
 * участника: конвертации нет, и `convert` его не публикует.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'regstatement'

/**
 * @interface
 */
export type IRegstatement = Edubridge.IRegstatement
