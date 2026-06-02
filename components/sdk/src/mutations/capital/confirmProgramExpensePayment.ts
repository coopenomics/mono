import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalConfirmProgramExpensePayment'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'PayProgramExpenseInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['PayProgramExpenseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
