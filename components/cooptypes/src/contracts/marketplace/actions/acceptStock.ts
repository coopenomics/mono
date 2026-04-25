import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const
export const actionName = 'acceptstock'

export interface IAcceptStock {
  coopname: string
  username: string
  request_hash: string
  convert_in: {
    hash: string
    public_key: string
    signature: string
    meta: string
  }
  return_statement: {
    hash: string
    public_key: string
    signature: string
    meta: string
  }
}
