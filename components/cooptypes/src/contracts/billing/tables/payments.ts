import type * as Billing from '../../../interfaces/billing'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'payments'

/**
 * Таблица хранится в {@link ContractNames._billing | области памяти контракта}.
 */
export const scope = ContractNames._billing

/**
 * @interface
 * Реестр проведённых платежей (anti-replay): идентификатор платежа
 * (`payment_hash`) и время проведения. Повтор `payment_hash` отклоняется
 * on-chain — двойное списание средств невозможно даже при потере
 * подтверждения инициатором (cron Восхода / PowerupPlugin).
 */
export type IPayment = Billing.IPayment
