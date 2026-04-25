import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const
export const actionName = 'destroy'

export interface IDestroy {
  coopname: string
  request_hash: string
  destruction_act: {
    hash: string
    public_key: string
    signature: string
    meta: string
  }
}
