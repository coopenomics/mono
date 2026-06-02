import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalAuthorizeProgramExpense'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'AuthorizeProgramExpenseInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['AuthorizeProgramExpenseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
