import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateBranchExpense'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateBranchExpenseInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateBranchExpenseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
