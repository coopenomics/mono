import type * as Billing from '../../../interfaces/billing'
import { Actors } from '../../../common'

/**
 * Имя таблицы
 */
export const tableName = 'payments'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Факты оплаты подписок: сумма, идентификатор платежа (`payment_hash`) и время.
 */
export type IPayment = Billing.IPayment
