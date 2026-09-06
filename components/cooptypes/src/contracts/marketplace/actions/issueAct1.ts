import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Первая подпись Акта приёма-передачи (1115) заказчиком во исполнение протокола совета: issueauth → issueact1. Без движений по средствам.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'issueact1'

/**
 * @interface
 */
export type IIssueAct1 = Marketplace.IIssueAct1
