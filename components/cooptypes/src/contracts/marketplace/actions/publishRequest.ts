import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const
export const actionName = 'publishRequest'

export interface IPublishRequest {
  coopname: string
  [key: string]: unknown
}
