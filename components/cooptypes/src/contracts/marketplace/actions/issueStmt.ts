import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик подписывает Заявление о возврате паевого взноса имуществом (1113) на фактический состав: readyrecv → issuepend; контракт инлайн ставит повестку совета типа mktissue (обратные вызовы onmktisauth / onmktisdecl). Движений по средствам нет.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'issuestmt'

/**
 * @interface
 */
export type IIssueStmt = Marketplace.IIssueStmt
