import { programExpensesPaginationSelector } from '../../selectors/capital/paginationSelectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalProgramExpenses'

/**
 * Список программных расходов капитала через шасси expense.
 */
export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!'), options: $('options', 'PaginationInput') },
    programExpensesPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
