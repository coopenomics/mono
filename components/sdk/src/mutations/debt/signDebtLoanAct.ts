import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'signDebtLoanAct'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DebtSignLoanActInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DebtSignLoanActInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
