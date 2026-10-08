import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'createDebtLoan'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DebtCreateLoanInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DebtCreateLoanInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
