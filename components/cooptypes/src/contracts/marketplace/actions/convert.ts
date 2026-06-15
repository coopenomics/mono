import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Конвертация паевого взноса пайщика в членский кошелёк «Стола заказов»
 * (requirement 76). Один шаг ledger2: o.mkt.conv (TRANSFER w.wal.share →
 * w.mkt.member). Пополняет членские средства под заказ имущества со склада
 * (stockorder фондируется только из членских). Заявление о конвертации (1110)
 * публикуется в реестр документов отдельным пакетом.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'convert'

/**
 * @interface
 */
export type IConvert = Marketplace.IConvert
