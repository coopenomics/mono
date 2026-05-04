import type * as Apps from '../../../interfaces/apps'

/**
 * Авторизация не требуется — операция доброкачественная (TTL-очистка просроченных
 * superseded-записей). Любой может вызвать.
 */
export const authorizations = [] as const

/**
 * Имя действия
 */
export const actionName = 'cleanup'

/**
 * @interface
 */
export type ICleanup = Apps.ICleanup
