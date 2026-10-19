import * as Permissions from '../../../common/permissions'
import type * as Billing from '../../../interfaces/billing'
import { Actors } from '../../../common'

/**
 * Требуется авторизация {@link Actors._coopname | аккаунта кооператива}
 * (coopname@active). Бездокументарная конвертация членского взноса в AXON:
 * PowerupPlugin coopback'а пайщика подписывает действие сам, без relay через
 * оператора платформы. Второй шаг двухшаговой модели (после `convert`).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'converttoaxn'

/**
 * @interface
 * Конвертирует членский взнос (RUB) в AXON по курсу 10:1 с эмиссией токена.
 */
export type IConvertToAxn = Billing.IConverttoaxn
