// Canonical таблицы контракта marketplace (Story 11.1).

/**
 * On-chain Order'ы — анкеры процесса p.mkt.supply.
 */
export * as Orders from './orders'

/**
 * Заявления на гарантийный возврат — анкеры процесса p.mkt.return.
 */
export * as RetRequests from './retrequests'

/**
 * Проекты решений совета о списании скоропорта — анкеры процесса p.mkt.wroff.
 */
export * as WroffProps from './wroffprops'

/**
 * Singleton-конфигурация «Стола заказов» — единая ставка членского взноса (requirement b6).
 */
export * as Config from './config'

/**
 * Отсечки персонального распределения членского взноса по КУ (requirement b6).
 */
