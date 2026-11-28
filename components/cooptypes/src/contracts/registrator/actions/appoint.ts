import * as Permissions from '../../../common/permissions'
import type * as Registrator from '../../../interfaces/registrator'
import { Actors } from '../../../common'

// Подписывает ведущий сети — кооператив, чьё имя хранит строка `network` реестра.
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._lead }] as const

/**
 * Имя действия
 */
export const actionName = 'appoint'

/**
 * @interface
 */
export type IAppoint = Registrator.IAppoint
