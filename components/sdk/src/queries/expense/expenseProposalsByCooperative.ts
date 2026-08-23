import { expenseProposalsPaginationSelector } from '../../selectors/expense'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'expenseProposalsByCooperative'

export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!'), options: $('options', 'PaginationInput') },
    expenseProposalsPaginationSelector,
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
