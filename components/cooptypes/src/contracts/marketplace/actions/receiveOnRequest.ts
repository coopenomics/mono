import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const
export const actionName = 'receiveOnRequest'

export interface IReceiveOnRequest {
  coopname: string
  [key: string]: unknown
}
