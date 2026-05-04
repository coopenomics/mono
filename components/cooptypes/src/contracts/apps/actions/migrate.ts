import * as Permissions from '../../../common/permissions'
import type * as Apps from '../../../interfaces/apps'
import { Actors } from '../../../common'

/**
 * Авторизация: apps@active — действие предназначено для CDT-апгрейдов.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'migrate'

/**
 * @interface
 */
export type IMigrate = Apps.IMigrate
