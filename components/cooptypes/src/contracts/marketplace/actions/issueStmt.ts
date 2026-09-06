import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик подписывает Заявление о возврате паевого взноса имуществом (1113) на фактический состав: readyrecv → issuepend; контракт инлайн ставит повестку совета типа mktissue (обратные вызовы onmktisauth / onmktisdecl). Движений по телу заказа нет; при факте больше заказа недостающая на довзнос часть членского кошелька конвертируется из свободного паевого по заявлению 1110 `convert_statement` (иначе документ пустой).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'issuestmt'

/**
 * @interface
 */
export type IIssueStmt = Marketplace.IIssueStmt
