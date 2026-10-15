import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Совет отказал по заявлению об аннулировании подписки по Гарантийным
 * условиям: заморозка взноса снимается, подписка продолжает действовать.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'warrdecline'

/**
 * @interface
 */
export type IWarrdecline = Edubridge.IWarrdecline
