import type * as Apps from '../../../interfaces/apps'
import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'

/**
 * Очистка отработавших записей каталога по всем пакетам — общее действие всех
 * контрактов, вызывается раскаткой на каждом деплое. Подписывает контракт.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'cleanup'

/**
 * @interface
 */
export type ICleanup = Apps.ICleanup
