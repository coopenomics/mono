import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const
export const actionName = 'coopstock'

export interface ICoopstock {
  coopname: string
  braname: string
  hash: string
  units: number
  unit_cost: string
  product_lifecycle_secs: number
  warranty_period_secs: number
  membership_fee_amount: string
  meta: string
}
