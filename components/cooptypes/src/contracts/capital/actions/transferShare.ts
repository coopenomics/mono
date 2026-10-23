import * as Permissions from '../../../common/permissions'
import type * as Capital from '../../../interfaces/capital'
import { Actors } from '../../../common'

/**
 * Трансляция паевого взноса пайщика из ЦПП «Благорост» в ЦПП «Цифровой
 * Кошелёк» по его заявлению (1090): сумма переходит с кошелька программы на
 * главный паевой (o.cap.wthcap), на весь остаток или его часть. Отправляет
 * бэкенд ключом кооператива — только пайщикам, которым кооператив выдал доступ.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'wthshare'

/**
 * @interface
 */
export type ITransferShare = Capital.IWthshare
