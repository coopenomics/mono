import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Трансляция паевого взноса преподавателя из ЦПП «Образование» в ЦПП
 * «Цифровой Кошелёк» по его заявлению (3015): сумма переходит с паевого
 * кошелька программы на главный паевой (o.edu.wthshr), на весь остаток или
 * его часть. Отправляет бэкенд ключом кооператива.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'wthshare'

/**
 * @interface
 */
export type IWthshare = Edubridge.IWthshare
