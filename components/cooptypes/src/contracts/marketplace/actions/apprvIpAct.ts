import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель совета подписал акт приёма имущества второй подписью в «Запросах одобрения» —
 * имущество принято (o.mkt.iprop, Дт 10 / Кт 80). Вызывает только контракт совета. Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'apprvipact'

/**
 * @interface
 */
export type IApprvIpAct = Marketplace.IApprvIpAct
