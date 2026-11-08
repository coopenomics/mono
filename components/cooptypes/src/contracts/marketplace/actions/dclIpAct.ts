import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель совета отказал в подписи акта приёма имущества: заявление возвращается к подписи
 * акта вносящим. Вызывает только контракт совета. Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'dclipact'

/**
 * @interface
 */
export type IDclIpAct = Marketplace.IDclIpAct
