import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'returnExpenseItem'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ReturnExpenseItemInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ReturnExpenseItemInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
