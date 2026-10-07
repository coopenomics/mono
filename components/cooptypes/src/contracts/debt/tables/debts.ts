import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Имя таблицы
 */
export const tableName = 'debts'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Открытые беспроцентные займы пайщиков: свои и зарегистрированные другими приложениями.
 */
export type IDebt = Debt.IDebt
