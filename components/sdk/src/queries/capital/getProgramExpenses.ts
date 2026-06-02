import { programExpensesPaginationSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalProgramExpenses'

/**
 * Список расходов программы «Благорост» с фильтрацией и пагинацией.
 */
export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'ProgramExpenseFilter'), options: $('options', 'PaginationInput') },
    programExpensesPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['ProgramExpenseFilter']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
