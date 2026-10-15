import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Оператор участка принимает имущество на очном осмотре (p.mkt.return): подписывает
 * своё заявление в совет об отмене сделки (1116) и вторую подпись на рекламации
 * пайщика (1106); контракт ставит повестку совета. Движений по средствам нет —
 * они идут по решению совета (onmktrtauth). Статус approvvisit → retpend.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'accretrn'

/**
 * @interface
 */
export type IAccRetrn = Marketplace.IAccRetrn
