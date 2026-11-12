import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Паевой взнос деньгами в кооперативный участок: трансляция паевого взноса в договор участия по заявлению 1119 (o.mkt.inv). Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'investmoney'

/**
 * @interface
 */
export type IInvestMoney = Marketplace.IInvestMoney
