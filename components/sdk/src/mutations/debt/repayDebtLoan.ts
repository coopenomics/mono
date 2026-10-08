import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'repayDebtLoan'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DebtRepayLoanInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DebtRepayLoanInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
