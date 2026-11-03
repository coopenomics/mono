/**
 * Реестр фондов кооператива: пять стандартных фондов, их проценты и кошельки
 * ledger2 (задача 99D-25). Остатки — в ledger2 по кошельку фонда.
 */
export * as Funds from './funds'

/**
 * @deprecated Прежний учёт остатков фондов накопления; строки стираются
 * `fund::cleanup` на деплое (задачи 99D-25, 99D-26). Читать `Funds`.
 */
export * as AccumulatedFunds from './accumulationFunds'

/**
 * Таблица содержит информацию о фондах списания и их балансах.
 */
export * as ExpensedFunds from './expenseFunds'

/**
 * Таблица содержит сводную информацию о балансе кошелька всех фондов кооператива.
 */
export * as CoopWallet from './coopWallet'

/**
 * Таблица содержит информацию о запросах на списание по статьям и выводах из фондов.
 */
export * as FundWithdraws from './fundWithdraws'
