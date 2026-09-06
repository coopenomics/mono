import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Закрывающая подпись Акта (1115) председателем, доверенным или оператором участка выдачи: issueact1 → received. Единственная точка движений: корректировка по факту, o.mkt.consum (Дт 80 / Кт 10), членский взнос участка.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'issueact2'

/**
 * @interface
 */
export type IIssueAct2 = Marketplace.IIssueAct2
