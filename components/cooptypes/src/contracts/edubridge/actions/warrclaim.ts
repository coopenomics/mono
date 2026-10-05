import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Публикация Заявления об аннулировании Подписки по Гарантийным условиям:
 * основание для рассмотрения советом, движений средств нет.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'warrclaim'

/**
 * @interface
 */
export type IWarrclaim = Edubridge.IWarrclaim
