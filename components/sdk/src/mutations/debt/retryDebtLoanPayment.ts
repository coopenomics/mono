import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'retryDebtLoanPayment'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DebtLoanRefInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DebtLoanRefInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
