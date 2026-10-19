import { expenseAdvancesPaginationSelector } from '../../selectors/expense'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'expenseAdvancesByCooperative'

export const query = Selector('Query')({
  [name]: [
    {
      coopname: $('coopname', 'String!'),
      filter: $('filter', 'ExpenseAdvancesFilterInput'),
      options: $('options', 'PaginationInput'),
    },
    expenseAdvancesPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  filter?: ModelTypes['ExpenseAdvancesFilterInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
