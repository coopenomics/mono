import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'

/**
 * Выход пайщика из кооператива состоялся (задача 99D-33): остаток обеспечительной
 * части к списанию списывается в членский взнос участка пайщика немедленно
 * (o.mkt.exfee, o.brn.common), строки его счётчиков списания стираются.
 * Вызывает только контракт registrator инлайн-действием; авторизация — registrator.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: 'registrator' }] as const

export const actionName = 'exitdue'

/**
 * @interface
 */
export type IExitDue = Marketplace.IExitDue
