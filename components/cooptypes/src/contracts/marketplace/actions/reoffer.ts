import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const
export const actionName = 'reoffer'

export interface IReoffer {
  coopname: string
  request_hash: string
  new_hash: string
  new_unit_cost: string
  new_meta: string
}
