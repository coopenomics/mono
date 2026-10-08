import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'extendDebtLoan'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DebtExtendLoanInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DebtExtendLoanInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
