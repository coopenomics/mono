import * as Permissions from '../../../../common/permissions'
import * as ContractNames from '../../../../common/names'
import type * as Soviet from '../../../../interfaces/soviet'

/**
 * Действие выполняется автоматически по ходу работы системы за подписью контракта _soviet.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._soviet }] as const

/**
 * Имя действия
 */
export const actionName = 'newdeclined'

/**
 * @interface
 * Действие фиксирует в реестре отклонённый (аннулированный) документ.
 * @private
 */
export type INewDeclined = Soviet.INewdeclined
