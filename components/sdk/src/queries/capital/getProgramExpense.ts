import { programExpenseSelector } from '../../selectors/capital/programExpenseSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'capitalProgramExpense'

/**
 * Программный расход по expense_hash.
 */
export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!'), expense_hash: $('expense_hash', 'String!') }, programExpenseSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  expense_hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
