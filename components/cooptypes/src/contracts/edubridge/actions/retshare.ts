import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Возврат остатка кошелька ЦПП «Образование» в паевой взнос по заявлению ученика: o.edu.retshr.
 * Отправляет бэкенд ключом кооператива.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'retshare'

/**
 * @interface
 */
export type IRetshare = Edubridge.IRetshare
