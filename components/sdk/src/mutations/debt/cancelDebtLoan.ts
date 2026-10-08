import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'cancelDebtLoan'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DebtCancelLoanInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DebtCancelLoanInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
