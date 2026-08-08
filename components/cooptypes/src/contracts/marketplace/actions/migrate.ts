import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заглушка миграции — donor-таблиц нет. Оставлена для совместимости с прежним ABI.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'migrate'

/**
 * @interface
 */
export type IMigrate = Marketplace.IMigrate
