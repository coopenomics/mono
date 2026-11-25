import type * as Fund from '../../../interfaces/fund'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'funds'

/**
 * Таблица хранится в {@link ContractNames._fund | области памяти контракта}, scope — кооператив.
 */
export const scope = ContractNames._fund

/**
 * @interface
 * Реестр фондов кооператива — настройки без остатков (задача 99D-25): пять
 * стандартных фондов, у каждого — кошелёк ledger2 на счёте 86 (кошелёк и есть
 * субсчёт фонда). Остатки и движения читаются из ledger2 по полю `wallet`.
 */
export type IFund = Fund.IFundrow

/** Вид фонда в поле `kind`: накопления (процент отчислений) или списания (транзит выплат). */
export const KIND_ACCUMULATION = 'accum'
export const KIND_EXPENDITURE = 'expend'

/** Номера стандартных фондов — постоянные у всех кооперативов. */
export const INDIVISIBLE_ID = 1
export const RESERVE_ID = 2
export const DEVELOPMENT_ID = 3
export const ECONOMIC_ID = 4
export const MUTUAL_ID = 5
