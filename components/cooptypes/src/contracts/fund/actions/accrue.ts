import * as Permissions from '../../../common/permissions'
import * as ContractNames from '../../../common/names'
import type * as Fund from '../../../interfaces/fund'

/**
 * Зовёт контракт-источник членского взноса инлайн (сегодня — marketplace при
 * списании обеспечительной части участка) либо кооператив.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._marketplace }] as const

/**
 * Имя действия
 */
export const actionName = 'accrue'

/**
 * @interface
 * Отчисление в фонды накопления кооператива из членского взноса участка:
 * контракт fund делит сумму по процентам фондов и зачисляет на `w.fnd.accum`
 * по каждому фонду (`o.fnd.accrue`, Дт 80 / Кт 86) в нитке процесса источника.
 */
export type IAccrue = Fund.IAccrue
