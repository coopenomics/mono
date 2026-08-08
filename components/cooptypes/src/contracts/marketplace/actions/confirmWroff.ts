import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель кооперативного участка подтверждает фактическое списание со
 * склада своего КУ по авторизованному советом проекту (ручной шаг стола ПВЗ,
 * p.mkt.wroff). Совет лишь признаёт списание допустимым; имущество выбывает
 * со склада только после подписи Служебной записки о списании (registry 1111)
 * ответственным за склад председателем КУ.
 *
 * Гранулярность — по одному КУ (`braname`) за вызов: проект может охватывать
 * несколько участков, каждый председатель закрывает только свою часть.
 * Авторизация — `coopname`; `signer` должен быть авторизован для `braname`
 * через Branch::is_user_authorized.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'confirmwroff'

/**
 * @interface
 */
export type IConfirmWroff = Marketplace.IConfirmWroff
