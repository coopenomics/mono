import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'chairmanSignDebtLoan'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DebtChairmanSignLoanInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DebtChairmanSignLoanInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
