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
 * Итоги прогонов списания по участкам (задача 99D-21).
 */
export * as Periods from './periods'

/**
 * Счётчики обеспечительной части к списанию: по пайщику и по участку за период (задача 99D-33).
 */
export * as Dues from './dues'
export * as Counters from './counters'

/**
 * Инициаторы кооперативных участков Стола заказов (задача 99D-21).
 */
export * as Initiators from './initiators'

/**
 * Отсечки персонального распределения членского взноса по КУ (requirement b6).
 */

/**
 * Инвестиционный этап кооперативного участка (задача 99D-27).
 */
export * as InvAgreements from './invAgreements'
export * as InvBranches from './invBranches'
export * as Investors from './investors'
export * as InvProps from './invProps'
