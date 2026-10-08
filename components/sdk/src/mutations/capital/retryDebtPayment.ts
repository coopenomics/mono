import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalRetryDebtPayment'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalDebtRefInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalDebtRefInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
