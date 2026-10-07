import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Миграция данных контракта.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'migrate'

/**
 * @interface
 */
export type IMigrate = Debt.IMigrate
