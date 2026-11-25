import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Списание строки счётчика пайщика за период (задачи 99D-21, 99D-33): узел
 * называет пайщика, участок и период, суммы контракт берёт из своей строки
 * `kudues`. По ставкам итога участка: участку (o.brn.common, Дт 80 / Кт 86),
 * в фонды накопления (o.fnd.*), инициаторам (o.mkt.repay либо участку), остаток
 * пайщику на свободный паевой (o.mkt.retdue); удержания при отказе — участку
 * целиком. Нитка p.mkt.due с хэшем строки. Строка стирается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'chargeperiod'

/**
 * @interface
 */
export type IChargePeriod = Marketplace.IChargePeriod
