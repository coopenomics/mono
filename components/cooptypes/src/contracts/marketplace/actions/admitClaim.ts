import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Поставщик признал гарантийную претензию: сумма переходит в признанный долг и удерживается из следующих выплат (o.mkt.admit).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'admitclaim'

/**
 * @interface
 */
export type IAdmitClaim = Marketplace.IAdmitClaim
