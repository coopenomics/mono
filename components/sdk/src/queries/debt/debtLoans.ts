import { loansPaginationSelector } from '../../selectors/debt'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'debtLoans'

export const query = Selector('Query')({
  [name]: [
    {
      filter: $('filter', 'DebtLoanFilterInput!'),
      options: $('options', 'PaginationInput'),
    },
    loansPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter: ModelTypes['DebtLoanFilterInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
