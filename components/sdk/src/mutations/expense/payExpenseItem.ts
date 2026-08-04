import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'payExpenseItem'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'PayExpenseItemInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['PayExpenseItemInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
